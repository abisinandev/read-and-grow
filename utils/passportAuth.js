import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/userSchema.js";
import { CONFIG } from "./constants/envConfig.js";

passport.use(
    new GoogleStrategy(
        {
            clientID: CONFIG.GOOGLE_CLIENT_ID,
            clientSecret: CONFIG.GOOGLE_CLIENT_SECRET,
            callbackURL: CONFIG.GOOGLE_CALLBACK_URL,
            passReqToCallback: true,
        },

        async function (_request, _accessToken, _refreshToken, profile, done) {
            try {
                const email = profile?.emails?.[0]?.value;
                if (!email) {
                    return done(null, false, { message: "Google account has no email" });
                }

                const existUser = await User.findOne({ email });

                if (existUser) {
                    if (existUser.role === 'admin') {
                        console.log("Admin can't join here");
                        return done(null, false, { message: "Admin can't join here" });
                    }
                    return done(null, existUser);
                }

                let newUserPayload = {
                    username: profile.displayName,
                    email,
                    googleId: profile.id,
                    isBlocked: false,
                    isEmailVerfied: true,
                    role: 'user',
                };

                if (profile?.phone) {
                    newUserPayload.phoneNumber = profile.phone;
                }

                const newUser = await User.create(newUserPayload);
                newUser.id = newUser._id.toString();
                await newUser.save();

                return done(null, newUser);
            } catch (error) {
                if (error?.code === 11000) {
                    console.error("Google auth duplicate key error:", error.keyValue);
                    return done(null, false, { message: "Account already exists. Please try logging in again." });
                }
                console.error("Google auth strategy error:", error);
                return done(error);
            }
        }
    )
);


passport.serializeUser(function (user, done) {
    done(null, user);
});


passport.deserializeUser(function (user, done) {
    done(null, user);
});

export default passport 