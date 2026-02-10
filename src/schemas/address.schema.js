import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['home', 'work', 'billing', 'shipping', 'other'],
      default: 'home',
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Full name must be less than 100 characters'],
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Address line 1 must be less than 200 characters'],
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [200, 'Address line 2 must be less than 200 characters'],
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'City must be less than 100 characters'],
    },
    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'State must be less than 100 characters'],
    },
    zipCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: [20, 'Zip code must be less than 20 characters'],
    },
    country: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Country must be less than 100 characters'],
      default: 'United States',
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number must be less than 20 characters'],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

export default addressSchema;
