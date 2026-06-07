from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.models import EmailAddress
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter


class AccountAdapter(DefaultAccountAdapter):
    """Email/password signups don't collect a name, so seed ``display_name``
    from the local part of the email to avoid blank profiles."""

    def save_user(self, request, user, form, commit=True):
        user = super().save_user(request, user, form, commit=False)
        if not user.display_name and user.email:
            user.display_name = user.email.split("@")[0]
        if commit:
            user.save()
        return user


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    """Enforce one-account-per-email across login methods.

    If someone signs in with Google using an email that already belongs to an
    account (e.g. they originally signed up with email/password), connect the
    Google login to that existing account instead of creating a second one.
    Google emails are verified by Google, and local accounts are email-verified
    (ACCOUNT_EMAIL_VERIFICATION = "mandatory"), so linking by email is safe.
    """

    def is_auto_signup_allowed(self, request, sociallogin):
        """Never fall back to allauth's classic HTML signup form.

        By default allauth bypasses auto-signup (and renders the unstyled
        ``/accounts/3rdparty/signup/`` page on the API domain) whenever the
        social email collides with an existing account. But ``pre_social_login``
        below already resolves every collision — it connects to a verified
        account or drops unverified claims — so there's nothing left for that
        form to collect. As long as we have an email (Google always returns a
        verified one), auto-create silently and send the user back to the SPA.
        """
        if sociallogin.user.email:
            return True
        return super().is_auto_signup_allowed(request, sociallogin)

    def pre_social_login(self, request, sociallogin):
        if sociallogin.is_existing:
            return

        email = (sociallogin.user.email or "").lower()
        if not email:
            return

        addresses = EmailAddress.objects.filter(email__iexact=email)

        # Only link to an account that has VERIFIED this email — that proves the
        # account legitimately owns it. Linking across a *verified* boundary is
        # safe; linking to an unverified record is an account-takeover vector
        # (an attacker could pre-register the victim's email, unverified, and
        # have the victim's Google login attach to the attacker's account).
        verified = addresses.filter(verified=True).first()
        if verified:
            sociallogin.connect(request, verified.user)
            return

        # Otherwise only unverified claims on this email exist (an abandoned
        # email signup, or a squatter). The incoming Google email is verified,
        # so it is authoritative: drop the unverified claim(s) and let allauth
        # create a fresh, Google-owned account. Never link across an unverified
        # boundary.
        addresses.delete()
