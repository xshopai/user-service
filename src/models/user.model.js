import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import addressSchema from '../schemas/address.schema.js';
import paymentSchema from '../schemas/payment.schema.js';
import wishlistSchema from '../schemas/wishlist.schema.js';
import preferencesSchema from '../schemas/preferences.schema.js';

const userSchema = new mongoose.Schema(
  {
    // Identity/Auth fields
    email: {
      type: String,
      required: true,
      unique: [true, 'Email already exists'],
      trim: true,
    },
    password: {
      type: String,
      minlength: [6, 'Password must be between 6 and 100 characters'],
      maxlength: [100, 'Password must be between 6 and 100 characters'],
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name must be less than 50 characters'],
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name must be less than 50 characters'],
    },
    phoneNumber: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number must be less than 20 characters'],
    },
    roles: {
      type: [String],
      enum: ['customer', 'admin'],
      default: ['customer'],
    },

    // Account-level status flags
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Operational data as arrays
    addresses: [addressSchema],
    paymentMethods: [paymentSchema],
    wishlist: [wishlistSchema],
    preferences: preferencesSchema,

    // Audit trail fields
    createdBy: {
      type: String,
      default: 'SELF_REGISTRATION', // For user self-registration
    },
    updatedBy: {
      type: String,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  // Handle password hashing
  if (
    this.isModified('password') &&
    this.password &&
    typeof this.password === 'string' &&
    this.password.length > 0 &&
    !/^\$2[aby]\$\d{2}\$/.test(this.password)
  ) {
    this.password = await bcrypt.hash(this.password, 12);
  }

  // Handle audit fields for self-registration
  if (this.isNew) {
    // For new users (registration), if createdBy is not set, use SELF_REGISTRATION
    if (!this.createdBy) {
      this.createdBy = 'SELF_REGISTRATION';
    }
    // For new users, set updatedBy same as createdBy initially
    if (!this.updatedBy) {
      this.updatedBy = this.createdBy;
    }
  } else if (this.isModified() && !this.isModified('updatedBy')) {
    // For updates where updatedBy is not explicitly set, you might want to:
    // - Leave it undefined (current behavior)
    // - Set it to the user's own ID if they're updating themselves
    // - Set it based on context (would need to be passed from controller)
  }

  next();
});

// Create indexes for query performance (required for Cosmos DB MongoDB API)
// createdAt is used for sorting in admin user list
userSchema.index({ createdAt: -1 });
// Compound index for common admin queries
userSchema.index({ email: 1 });
userSchema.index({ roles: 1, createdAt: -1 });

const User = mongoose.model('User', userSchema);
export default User;
