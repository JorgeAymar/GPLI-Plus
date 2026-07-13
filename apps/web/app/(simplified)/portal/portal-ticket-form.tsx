import { listDropdownItems, listTicketFieldDefinitions } from "@itsm/core";
import type { DropdownItem } from "@itsm/db";
import { PortalTicketFormClient } from "./portal-ticket-form-client";

/**
 * Server wrapper kept separate from the interactive client form (portal-ticket-form-client.tsx)
 * so this component can stay an async Server Component and fetch its own dynamic-field data -
 * that way portal/page.tsx (owned by another agent working on Service Catalog in parallel) needs
 * no changes at all: it keeps calling `<PortalTicketForm entityId={...} />` exactly as before.
 */
export async function PortalTicketForm({ entityId }: { entityId: string }) {
  // Portal never lets the end user pick a type, so only fetch defs for "incident"
  // (which also includes ticketType === null defs shared with "request").
  const fields = await listTicketFieldDefinitions("incident");

  const dropdownOptions: Record<string, DropdownItem[]> = {};
  for (const field of fields) {
    if (field.fieldType === "dropdown" && field.dropdownCategoryId) {
      dropdownOptions[field.key] = await listDropdownItems(field.dropdownCategoryId, entityId);
    }
  }

  return <PortalTicketFormClient entityId={entityId} fields={fields} dropdownOptions={dropdownOptions} />;
}
