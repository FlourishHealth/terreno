import mongoose, {type Document} from "mongoose";

export interface AuditLogDocument extends Document {
  action: string;
  resourceType: string;
  resourceKey: string;
  field?: string;
  previousValue?: any;
  newValue?: any;
  userId: mongoose.Types.ObjectId;
  targetUserId?: mongoose.Types.ObjectId;
  timestamp: Date;
}

const auditLogSchema = new mongoose.Schema<AuditLogDocument>(
  {
    action: {
      description: "The action performed (e.g., 'update', 'set_override', 'remove_override')",
      required: true,
      type: String,
    },
    field: {
      description: "The specific field that was changed",
      type: String,
    },
    newValue: {
      description: "The new value after the change",
      type: mongoose.Schema.Types.Mixed,
    },
    previousValue: {
      description: "The previous value before the change",
      type: mongoose.Schema.Types.Mixed,
    },
    resourceKey: {
      description: "The key of the resource that was changed",
      index: true,
      required: true,
      type: String,
    },
    resourceType: {
      description: "The type of resource that was changed (e.g., 'feature_flag')",
      required: true,
      type: String,
    },
    targetUserId: {
      description: "The user affected by the change (for per-user overrides)",
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
    timestamp: {
      default: () => new Date(),
      description: "When the change occurred",
      index: true,
      required: true,
      type: Date,
    },
    userId: {
      description: "The admin user who made the change",
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

export const AuditLog = mongoose.model<AuditLogDocument>("AuditLog", auditLogSchema);
