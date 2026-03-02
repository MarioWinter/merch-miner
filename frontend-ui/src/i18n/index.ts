import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Auth — common
      auth: {
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm password',
        login: 'Sign in',
        register: 'Create account',
        logout: 'Sign out',
        googleLogin: 'Continue with Google',
        googleRegister: 'Sign up with Google',
        forgotPassword: 'Forgot password?',
        resetPassword: 'Reset password',
        newPassword: 'New password',
        confirmNewPassword: 'Confirm new password',
        setNewPassword: 'Set new password',
        backToLogin: 'Back to sign in',
        orDivider: 'or',
        noAccount: "Don't have an account?",
        haveAccount: 'Already have an account?',
        signUpLink: 'Sign up',
        signInLink: 'Sign in',
      },
      // Login page
      login: {
        title: 'Welcome back',
        subtitle: 'Sign in to your Merch Miner workspace',
        success: 'Signed in successfully',
        error: 'Invalid email or password',
      },
      // Register page
      register: {
        title: 'Create your account',
        subtitle: 'Start your Merch Miner journey',
        success: 'Account created. Check your email to activate it.',
        error: 'Registration failed. Please try again.',
      },
      // Activate page
      activate: {
        title: 'Activating your account',
        success: 'Account activated! You can now sign in.',
        error: 'Activation failed. The link may have expired.',
        loading: 'Activating your account…',
        goToLogin: 'Go to sign in',
      },
      // Password reset
      passwordReset: {
        title: 'Reset your password',
        subtitle: 'Enter your email and we will send you a reset link.',
        success: 'Reset email sent. Check your inbox.',
        error: 'Failed to send reset email.',
        confirmTitle: 'Set new password',
        confirmSuccess: 'Password updated. You can now sign in.',
        confirmError: 'Failed to set password. The link may have expired.',
      },
      // Validation
      validation: {
        emailRequired: 'Email is required',
        emailInvalid: 'Enter a valid email address',
        passwordRequired: 'Password is required',
        passwordMinLength: 'Password must be at least 8 characters',
        passwordsNoMatch: 'Passwords do not match',
      },
      // App
      app: {
        name: 'Merch Miner',
        tagline: 'POD Business OS',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
