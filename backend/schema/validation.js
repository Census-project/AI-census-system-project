const Joi = require('joi');

// User registration validation
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('enumerator', 'supervisor', 'admin').default('enumerator'),
  passport_photo: Joi.string().optional(),
});

// Census record submission validation
const censusRecordSchema = Joi.object({
  household_id: Joi.string().required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  age: Joi.number().integer().min(0).max(150),
  gender: Joi.string().valid('M', 'F', 'Other'),
  phone: Joi.string().pattern(/^\d{10,15}$/),
  gps_latitude: Joi.number().min(-90).max(90),
  gps_longitude: Joi.number().min(-180).max(180),
  location_address: Joi.string(),
  custom_fields: Joi.object().pattern(Joi.string(), Joi.string().allow('')).optional(),
  submission_type: Joi.string().valid('online', 'offline').default('online'),
});

// Batch submission validation for offline sync
const batchSubmissionSchema = Joi.object({
  records: Joi.array()
    .items(censusRecordSchema)
    .min(1)
    .required(),
});

module.exports = {
  registerSchema,
  censusRecordSchema,
  batchSubmissionSchema,
};
