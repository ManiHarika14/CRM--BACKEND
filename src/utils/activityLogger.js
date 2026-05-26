const prisma = require("./prisma");

const isValidUUID = (value) => {
  if (!value) return false;
  const uuid = String(value).trim();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const cleanString = (value) => {
  if (typeof value !== "string") return value;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
};

const createActivity = async ({
  entity_type,
  entity_id,
  action,
  description,
  lead_id,
  customer_id,
  deal_id,
  task_id,
  note_id,
}) => {
  try {
    const cleanEntityType = cleanString(entity_type);
    const cleanAction = cleanString(action);
    const cleanDescription = cleanString(description);

    if (!cleanEntityType) {
      console.error("Activity logging skipped: entity_type is required");
      return null;
    }

    if (!entity_id || !isValidUUID(entity_id)) {
      console.error("Activity logging skipped: valid entity_id is required");
      return null;
    }

    if (!cleanAction) {
      console.error("Activity logging skipped: action is required");
      return null;
    }

    const activity = await prisma.activity.create({
      data: {
        entity_type: cleanEntityType,
        entity_id: String(entity_id).trim(),
        action: cleanAction,
        description: cleanDescription,
        lead_id: lead_id && isValidUUID(lead_id) ? String(lead_id).trim() : null,
        customer_id:
          customer_id && isValidUUID(customer_id) ? String(customer_id).trim() : null,
        deal_id: deal_id && isValidUUID(deal_id) ? String(deal_id).trim() : null,
        task_id: task_id && isValidUUID(task_id) ? String(task_id).trim() : null,
        note_id: note_id && isValidUUID(note_id) ? String(note_id).trim() : null,
      },
    });

    return activity;
  } catch (error) {
    console.error("Create activity error:", error);
    return null;
  }
};

module.exports = {
  createActivity,
};