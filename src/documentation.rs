use super::*;

struct MicrosoftOAuthSecurity;

impl Modify for MicrosoftOAuthSecurity {
  fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
    let components = openapi.components.get_or_insert_with(Components::default);

    if components.security_schemes.contains_key("microsoftOAuth") {
      return;
    }

    components.add_security_scheme(
      "microsoftOAuth",
      SecurityScheme::OAuth2(OAuth2::new([Flow::AuthorizationCode(
        AuthorizationCode::new(
          format!(
            "https://login.microsoftonline.com/{MCGILL_TENANT_ID}/oauth2/v2.0/authorize",
          ),
          format!(
            "https://login.microsoftonline.com/{MCGILL_TENANT_ID}/oauth2/v2.0/token",
          ),
          Scopes::from_iter([
            ("openid", "Authenticate with Microsoft."),
            (
              "User.Read",
              "Read basic Microsoft user profile information.",
            ),
          ]),
        ),
      )])),
    );
  }
}

#[derive(OpenApi)]
#[openapi(
  info(
    title = "mcgill.courses",
    description = "A course search and review platform for McGill University."
  ),
  servers(
    (url = "/api")
  ),
  modifiers(&MicrosoftOAuthSecurity),
  paths(
    auth::login_authorized,
    auth::logout,
    auth::microsoft_auth,
    averages::get_averages,
    courses::get_course_by_id,
    courses::get_courses,
    instructors::get_instructor,
    interactions::add_interaction,
    interactions::delete_interaction,
    interactions::get_interaction_kind,
    interactions::get_user_interactions_for_course,
    notifications::delete_notification,
    notifications::get_notifications,
    notifications::update_notification,
    reviews::add_review,
    reviews::delete_review,
    reviews::get_liked_reviews,
    reviews::get_review,
    reviews::get_reviews,
    reviews::update_review,
    search::search,
    subscriptions::add_subscription,
    subscriptions::delete_subscription,
    subscriptions::get_subscription,
    user::get_user
  ),
  components(
    schemas(
      averages::GetAveragesParams,
      averages::GetAveragesPayload,
      courses::GetCourseByIdParams,
      courses::GetCourseByIdPayload,
      courses::GetCoursesParams,
      courses::GetCoursesPayload,
      instructors::GetInstructorPayload,
      interactions::AddInteractionBody,
      interactions::DeleteInteractionBody,
      interactions::GetInteractionKindParams,
      interactions::GetInteractionKindPayload,
      interactions::GetUserInteractionForCoursePayload,
      notifications::DeleteNotificationBody,
      notifications::UpdateNotificationBody,
      reviews::AddOrUpdateReviewBody,
      reviews::DeleteReviewBody,
      reviews::GetReviewsParams,
      reviews::GetReviewsPayload,
      search::SearchParams,
      subscriptions::AddOrDeleteSubscriptionBody,
      subscriptions::GetSubscriptionParams,
      subscriptions::SubscriptionResponse,
      user::User,
      user::UserResponse,
    )
  ),
  tags(
    (name = "auth", description = "All authentication related endpoints."),
    (name = "averages", description = "All course average related endpoints."),
    (name = "courses", description = "All course related endpoints."),
    (name = "instructors", description = "All instructor related endpoints."),
    (name = "interactions", description = "All interaction related endpoints."),
    (name = "notifications", description = "All notification related endpoints."),
    (name = "reviews", description = "All review related endpoints."),
    (name = "search", description = "All search related endpoints."),
    (name = "subscriptions", description = "All subscription related endpoints."),
    (name = "user", description = "All user related endpoints."),
  ),
)]
pub(crate) struct Documentation;
