use super::*;

const GECKODRIVER_PORT: usize = 4444;
const MAX_ELEM_RETRIES: usize = 5;
const VSB_LOGIN_URL: &str = "https://vsb.mcgill.ca/login.jsp";

struct Driver(Child);

impl Drop for Driver {
  fn drop(&mut self) {
    let _ = self.0.kill();
    let _ = self.0.wait();
  }
}

pub(crate) fn authenticate() -> Result<String> {
  let email =
    env::var("VSB_EMAIL").expect("VSB_EMAIL must be specified for scraping");

  let password = env::var("VSB_PASSWORD")
    .expect("VSB_PASSWORD must be specified for scraping");

  let otp_secret = env::var("VSB_OTP_SECRET")
    .expect("VSB_OTP_SECRET must be specified for scraping");

  info!("Starting geckodriver server");

  let _geckodriver = Driver(
    Command::new("geckodriver")
      .args(["--port", &GECKODRIVER_PORT.to_string()])
      .spawn()?,
  );

  thread::sleep(Duration::from_secs(2));

  info!("Retrieving cookie for VSB authentication...");

  let rt = tokio::runtime::Builder::new_current_thread()
    .enable_all()
    .build()?;

  rt.block_on(get_vsb_cookie(email, password, otp_secret))
}

fn format_cookie(cookies: Vec<Cookie>) -> String {
  cookies
    .into_iter()
    .map(|c| format!("{}={}", c.name, c.value))
    .collect::<Vec<String>>()
    .join("; ")
}

async fn get_vsb_cookie(
  email: String,
  password: String,
  otp_secret: String,
) -> Result<String> {
  let mut caps = DesiredCapabilities::firefox();
  caps.set_headless()?;

  let driver =
    WebDriver::new(format!("http://localhost:{GECKODRIVER_PORT}"), caps)
      .await?;

  // Need to use `new_unchecked` because Microsoft auth secret length is too short.
  let totp = TOTP::new_unchecked(
    totp_rs::Algorithm::SHA1,
    6,
    1,
    30,
    Secret::Encoded(otp_secret.to_uppercase()).to_bytes()?,
  );

  driver.goto(VSB_LOGIN_URL).await?;

  info!("Entering email...");
  let email_field = retry_until_visible(&driver, By::Name("loginfmt")).await?;
  email_field.send_keys(email).await?;
  email_field.send_keys(Key::Return).await?;
  sleep(Duration::from_secs(1)).await;

  info!("Entering password...");
  let password_field = retry_until_visible(&driver, By::Name("passwd")).await?;
  password_field.send_keys(password).await?;
  sleep(Duration::from_secs(1)).await;

  info!("Signing in...");
  let submit_button =
    retry_until_visible(&driver, By::Id("idSIButton9")).await?;
  submit_button.click().await?;
  sleep(Duration::from_secs(1)).await;

  info!("Entering OTP...");
  let otp_field = retry_until_visible(&driver, By::Name("otc")).await?;
  otp_field.send_keys(totp.generate_current()?).await?;
  otp_field.send_keys(Key::Return).await?;
  sleep(Duration::from_secs(3)).await;

  info!("Finishing up...");
  let no_button = retry_until_visible(&driver, By::Id("idBtn_Back")).await?;
  no_button.click().await?;
  sleep(Duration::from_secs(1)).await;

  let cookies = driver.get_all_cookies().await?;

  driver.quit().await?;

  Ok(format_cookie(cookies))
}

async fn retry_until_visible(driver: &WebDriver, by: By) -> Result<WebElement> {
  let mut retries = 0;

  let mut elem = driver.find(by.clone()).await;

  while elem.is_err() {
    if retries > MAX_ELEM_RETRIES {
      break;
    }

    sleep(Duration::from_secs(1)).await;

    retries += 1;

    elem = driver.find(by.clone()).await;
  }

  Ok(elem?)
}
