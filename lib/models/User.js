import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  companyName: {
    type: String,
    required: true,
    trim: true,
  },
  countryCode: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: '',
    trim: true,
  },
  // The department a WAGA team member sits in, shown on the roster.
  department: {
    type: String,
    default: '',
    trim: true,
  },
  // The plaintext credential, kept ONLY so a WAGA admin can read back what was
  // issued to each person (the `password` above is a one-way bcrypt digest and
  // cannot be shown). select:false so it is never returned unless a caller that
  // has proven it is an admin explicitly asks for it. This is a deliberate,
  // client-requested convenience for a demo portal, not a security best practice.
  visiblePassword: {
    type: String,
    default: '',
    select: false,
  },
  // Which portals this account may sign in to, by slug (e.g. ['waga']). Admin
  // access is the `role` above and is separate — an admin reaches every portal
  // through the console. This is for a client given one portal of their own:
  // the portal's own sign-in checks its slug is in here, so granting or revoking
  // a portal is a change to this array, not a new credential store.
  portals: {
    type: [String],
    default: [],
  },
  utmSource: {
    type: String,
    default: '',
  },
  loginCount: {
    type: Number,
    default: 0,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  loginHistory: {
    type: [{
      ip: String,
      userAgent: String,
      timestamp: { type: Date, default: Date.now },
    }],
    default: [],
  },
  pageViews: {
    type: Map,
    of: Number,
    default: {},
  },
  totalPageViews: {
    type: Number,
    default: 0,
  },
  lastVisitedPage: {
    type: String,
    default: '',
  },
  // Additional passwords this account also accepts. A demo account is handed
  // to several people at once and they do not all get told the same thing;
  // rotating the one password breaks whoever had the old one mid-call. Stored
  // hashed like the primary, never returned, and empty for every account that
  // does not need it.
  altPasswords: {
    type: [String],
    default: [],
    select: false,
  },
}, { timestamps: true })

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10)
  }
  // Plain strings put on this array are hashed here; anything already a bcrypt
  // digest is left alone, so re-saving a loaded document does not double-hash.
  if (this.isModified('altPasswords') && Array.isArray(this.altPasswords)) {
    this.altPasswords = await Promise.all(
      this.altPasswords.filter(Boolean).map((p) => (/^\$2[aby]\$/.test(p) ? p : bcrypt.hash(p, 10)))
    )
  }
})

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (await bcrypt.compare(candidatePassword, this.password)) return true
  for (const hash of this.altPasswords || []) {
    if (await bcrypt.compare(candidatePassword, hash)) return true
  }
  return false
}

export default mongoose.models.User || mongoose.model('User', userSchema)
