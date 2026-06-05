const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
} = require("@aws-sdk/client-cognito-identity-provider");

const ACCESS_TOKEN_TTL = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL = 5 * 24 * 60 * 60 * 1000;
const prisma = require("../utils/prisma");
const { createAuthLog } = require("../utils/authLogger");
const env = require("../config/env");

const cognitoClient = new CognitoIdentityProviderClient({
  region: env.COGNITO_REGION,
});

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
};

const ACCESS_COOKIE_OPTIONS = { ...COOKIE_BASE, maxAge: ACCESS_TOKEN_TTL };
const REFRESH_COOKIE_OPTIONS = { ...COOKIE_BASE, maxAge: REFRESH_TOKEN_TTL };

const toCognitoUsername = (email) => email.replace("@", "_at_");

const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const username = toCognitoUsername(email);

    const tempUser = await prisma.user.create({
      data: { name: email, email, role: null, status: 0, password_hash: null, cognito_sub: null },
      select: { user_id: true, email: true, role: true, status: true },
    });

    let cognito_sub;
    try {
      const signUpResponse = await cognitoClient.send(
        new SignUpCommand({
          ClientId: env.COGNITO_CLIENT_ID,
          Username: username,
          Password: password,
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "name", Value: email },
            { Name: "gender", Value: "not_specified" },
            { Name: "address", Value: "not_provided" },
            { Name: "phone_number", Value: "+10000000000" },
            { Name: "updated_at", Value: String(Math.floor(Date.now() / 1000)) },
          ],
        })
      );
      cognito_sub = signUpResponse.UserSub;
    } catch (cognitoError) {
      await prisma.user.delete({ where: { user_id: tempUser.user_id } }).catch(() => {});
      throw cognitoError;
    }

    const user = await prisma.user.update({
      where: { user_id: tempUser.user_id },
      data: { cognito_sub },
      select: { user_id: true, email: true, role: true, status: true },
    });

    await createAuthLog({ req, user_id: user.user_id, action: "user_registered" });

    return res.status(201).json({
      success: true,
      message: "Registration successful. Check your email for the verification code.",
    });
  } catch (error) {
    if (error.name === "UsernameExistsException") {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }
    if (error.name === "InvalidPasswordException") {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.name === "InvalidParameterException") {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error during registration" });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, message: "Email and code are required" });
    }

    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.status === 1) {
      return res.status(400).json({ success: false, message: "Email already verified" });
    }

    const username = toCognitoUsername(email);

    await cognitoClient.send(
      new ConfirmSignUpCommand({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: username,
        ConfirmationCode: code,
      })
    );

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: { status: 1 },
    });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    if (error.name === "CodeMismatchException") {
      return res.status(400).json({ success: false, message: "Invalid verification code" });
    }
    if (error.name === "ExpiredCodeException") {
      return res.status(400).json({ success: false, message: "Verification code expired. Please request a new one." });
    }
    if (error.name === "NotAuthorizedException") {
      return res.status(400).json({ success: false, message: "User already confirmed" });
    }
    console.error("VERIFY OTP ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error during verification" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const username = toCognitoUsername(email);

    await cognitoClient.send(
      new ResendConfirmationCodeCommand({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: username,
      })
    );

    return res.status(200).json({
      success: true,
      message: "Verification code resent. Check your email.",
    });
  } catch (error) {
    if (error.name === "UserNotFoundException") {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (error.name === "InvalidParameterException") {
      return res.status(400).json({ success: false, message: "User is already confirmed" });
    }
    console.error("RESEND OTP ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error during resend" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await prisma.user.findFirst({ where: { email } });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (user.status !== 1) {
      await createAuthLog({ req, user_id: user.user_id, action: "account_inactive_login_attempt" });
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
      });
    }

    const username = toCognitoUsername(email);

    const authResponse = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      })
    );

    if (!authResponse.AuthenticationResult) {
      return res.status(403).json({ success: false, message: "Login challenge required. Please contact support." });
    }

    const { AccessToken, RefreshToken } = authResponse.AuthenticationResult;

    res.cookie("crm_token", AccessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie("crm_refresh_token", RefreshToken, REFRESH_COOKIE_OPTIONS);

    prisma.users_Log.create({ data: { id: user.user_id, log_type_id: 1, date_time: new Date() } }).catch((e) => console.error("users_Log error:", e.message));
    createAuthLog({ req, user_id: user.user_id, action: "login_success" });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    if (error.name === "NotAuthorizedException") {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    if (error.name === "UserNotConfirmedException") {
      return res.status(403).json({ success: false, message: "Please verify your email before logging in" });
    }
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error during login" });
  }
};

const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.crm_refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: "No refresh token" });
    }

    const authResponse = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: env.COGNITO_CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      })
    );

    if (!authResponse.AuthenticationResult) {
      return res.status(401).json({ success: false, message: "Session expired, please log in again" });
    }

    const { AccessToken } = authResponse.AuthenticationResult;

    const { CognitoJwtVerifier } = require("aws-jwt-verify");
    const verifier = CognitoJwtVerifier.create({
      userPoolId: env.COGNITO_USER_POOL_ID,
      clientId: env.COGNITO_CLIENT_ID,
      tokenUse: "access",
    });
    const payload = await verifier.verify(AccessToken);
    const user = await prisma.user.findFirst({ where: { cognito_sub: payload.sub } });
    if (!user || user.status !== 1) {
      res.clearCookie("crm_token", COOKIE_BASE);
      res.clearCookie("crm_refresh_token", COOKIE_BASE);
      return res.status(401).json({ success: false, message: "Account is not active" });
    }

    res.cookie("crm_token", AccessToken, ACCESS_COOKIE_OPTIONS);

    return res.status(200).json({ success: true, message: "Token refreshed" });
  } catch (error) {
    res.clearCookie("crm_token", COOKIE_BASE);
    res.clearCookie("crm_refresh_token", COOKIE_BASE);
    if (error.name === "NotAuthorizedException") {
      return res.status(401).json({ success: false, message: "Session expired, please log in again" });
    }
    console.error("REFRESH ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error during token refresh" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies?.crm_token;

    if (token) {
      try {
        await cognitoClient.send(new GlobalSignOutCommand({ AccessToken: token }));
      } catch (err) {
        console.warn("Cognito GlobalSignOut failed:", err.message);
      }
    }

    res.clearCookie("crm_token", COOKIE_BASE);
    res.clearCookie("crm_refresh_token", COOKIE_BASE);

    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error during logout" });
  }
};

const me = async (req, res) => {
  return res.status(200).json({ success: true, user: req.user });
};

module.exports = { register, verifyOtp, resendOtp, login, refresh, logout, me };
