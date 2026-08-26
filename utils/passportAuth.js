import dotenv from "dotenv";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/userSchema.js";

dotenv.config();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3999/auth/google/callback",
            passReqToCallback: true,
        },


        async function (request, accessToken, refreshToken, profile, done) {
 
            const existUser = await User.findOne({email:profile?.emails[0].value})
            console.log("existUser",existUser)
            if (existUser && existUser.role === 'admin') {
                console.log("Admin can't join here");
                return done(null, false, { message: "Admin can't join here" });
            }

            console.log(profile)
            const exist = await User.findOne({ email: profile["emails"][0].value });
            if (exist) {
                console.log('googleId is exists')
                return done(null,exist)
            }
            
            let newUserPayload = {
                username: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                isBlocked: false,
                isEmailVerfied: true,
                role: 'user',
            };

            if (profile?.phone) {
                newUserPayload.phoneNumber = profile.phone;
            }

            await User.create(newUserPayload);


            const googleUser = await User.findOne({ email: profile["emails"][0].value });
            googleUser.id = googleUser._id.toString()
            let user = await googleUser.save()
            console.log("user google auth :",user)

            return done(null, user);
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