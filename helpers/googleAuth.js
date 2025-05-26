import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.js';
import { generateToken } from './jwt.js';

// Konfigurasi Passport untuk Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Cek apakah user sudah ada di database
        const existingUser = await User.findByEmail(profile.emails[0].value);

        if (existingUser) {
          // Update last login
          await User.updateLastLogin(existingUser._id);
          return done(null, existingUser);
        }

        // Jika user belum ada, buat user baru
        const newUser = await User.create({
          email: profile.emails[0].value,
          name: profile.displayName,
          password: 'GOOGLE_AUTH_' + Math.random().toString(36).substring(7),
          role: 'user',
          googleId: profile.id,
          avatar: profile.photos[0]?.value,
          isEmailVerified: true // Email dari Google sudah terverifikasi
        });

        done(null, newUser);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

// Serialize user untuk session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user dari session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

/**
 * Generate token setelah login Google berhasil
 * @param {Object} user - User data
 * @returns {string} JWT token
 */
export const generateGoogleAuthToken = (user) => {
  return generateToken({
    _id: user._id,
    email: user.email,
    role: user.role
  });
};

export default passport; 