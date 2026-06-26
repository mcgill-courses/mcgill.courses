use super::*;

macro_rules! re {
  ($pat:expr) => {
    LazyLock::new(|| Regex::new(concat!("^", $pat, "$")).unwrap())
  };
}

pub(crate) static COURSE_CODE: LazyLock<Regex> =
  re!(r"[A-Z0-9]{4} [0-9]{3}(D1|D2|N1|N2|J1|J2|J3)?");

pub(crate) static COURSE_CODE_IN_TEXT: LazyLock<Regex> = LazyLock::new(|| {
  Regex::new(r"\b[A-Z0-9]{4} [0-9]{3}(D1|D2|N1|N2|J1|J2|J3)?\b").unwrap()
});
