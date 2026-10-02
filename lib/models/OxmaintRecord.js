import mongoose from 'mongoose'

// Everything the Oxmaint CMMS portal creates, in one collection.
//
// The alternative — a model per record type — would mean twelve schemas,
// twelve routes and twelve near-identical list handlers, for records that are
// only ever read back as "the things this portal made". The portal's own screens
// already know the shape of each kind; what the database is needed for is
// durability and sharing, not validation.
//
// So the fields that are queried live at the top level and are typed, and the
// rest of the record rides in `data`. A work order and a scrap note are stored
// side by side, told apart by `kind`.
const oxmaintRecordSchema = new mongoose.Schema(
  {
    // 'work_order' | 'asset' | 'part' | 'request' | 'pm_schedule' | 'inspection'
    // | 'checklist_run' | 'incident' | 'permit' | 'purchase_order' | 'vendor'
    // | 'scrap' | 'logbook' | 'document' | 'member' | 'team' | 'shutdown'
    kind: { type: String, required: true, index: true },

    // Which data pack the record was created under — 'chiller', 'hospitality'.
    //
    // A pack is a whole customer, and two packs share this collection. Without
    // this field a work order raised in the chiller demo appears in the hotel's
    // list against an asset that does not exist there, which is a leak between
    // customers rather than a merge — the same reasoning that gave the FSM
    // portal its own record kinds.
    //
    // Records written before this field existed carry no pack. They were created
    // when the only default was 'chiller', so that is where they are read back.
    pack: { type: String, default: '', index: true },

    // The portal's own id (`wo_k3f9x`), not Mongo's. Screens route by it, and a
    // record created here has to be indistinguishable from a seeded one.
    //
    // Unique per pack rather than globally: the seeded ids are generated the
    // same way in every pack, so `wo_0001` exists in all of them. Closing that
    // work order in two demos writes two rows carrying the same id, and a global
    // unique index would reject the second — the edit would fail in whichever
    // demo happened to be shown last.
    recordId: { type: String, required: true, index: true },

    // Queried on every list screen, so they are indexed rather than buried.
    siteId: { type: String, default: '', index: true },
    status: { type: String, default: '' },
    priority: { type: String, default: '' },
    title: { type: String, default: '' },

    // The record itself, exactly as the screen will render it.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Soft delete. A demo that loses a record on a misclick, with no way back,
    // is worse than one that cannot delete at all.
    deleted: { type: Boolean, default: false, index: true },

    createdByName: { type: String, default: '' },
  },
  { timestamps: true }
)

// The one query every screen makes: this pack's records of this kind, newest
// first. `pack` leads because it is the narrowest — it cuts the collection to
// one customer before `kind` cuts it to one screen.
oxmaintRecordSchema.index({ pack: 1, kind: 1, deleted: 1, createdAt: -1 })

// What `recordId` used to promise on its own. Mongoose adds this index but will
// not drop the old global `recordId_1`, so a database created before packs
// existed needs `npm run migrate:packs` once — until then the old index is still
// enforcing the rule this one replaces.
oxmaintRecordSchema.index({ pack: 1, recordId: 1 }, { unique: true })

export default mongoose.models.OxmaintRecord ||
  mongoose.model('OxmaintRecord', oxmaintRecordSchema)
