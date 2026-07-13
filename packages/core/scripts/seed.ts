import "dotenv/config";
import { db, entities } from "@itsm/db";
import { isNull } from "drizzle-orm";
import { createAssetDefinition, getAssetDefinitionByKey, updateAssetDefinition } from "../src/assets/asset-definition-service";
import { MODULE } from "../src/auth/modules";
import { RIGHT } from "../src/auth/permissions";
import { createDropdownCategory, createDropdownItem, getDropdownCategoryByKey, listDropdownItems } from "../src/dropdowns/dropdown-service";
import { createEntity } from "../src/entities/entity-service";
import {
  assignUserProfile,
  createProfile,
  listProfiles,
  listUserProfileAssignments,
  setModuleRight,
} from "../src/rbac/profile-service";
import { createNotificationTemplate, getNotificationTemplateByKey } from "../src/notifications/notification-service";
import { createSlaPolicy, listSlaPolicies } from "../src/sla/sla-service";
import { createUser, findUserByEmail } from "../src/users/user-service";

const CORE_ASSET_DEFINITIONS = [
  { key: "computer", name: "Computadora", hasExtensionTable: true },
  { key: "monitor", name: "Monitor", hasExtensionTable: false },
  { key: "network_equipment", name: "Equipo de red", hasExtensionTable: true },
  { key: "printer", name: "Impresora", hasExtensionTable: false },
  { key: "phone", name: "Teléfono", hasExtensionTable: false },
  { key: "peripheral", name: "Periférico", hasExtensionTable: false },
  { key: "datacenter", name: "Datacenter", hasExtensionTable: false },
  { key: "domain", name: "Dominio", hasExtensionTable: false },
  { key: "line", name: "Línea", hasExtensionTable: false },
  { key: "database", name: "Base de datos", hasExtensionTable: false },
  { key: "rack", name: "Rack", hasExtensionTable: false },
  { key: "enclosure", name: "Chasis/Enclosure", hasExtensionTable: false },
  { key: "pdu", name: "PDU", hasExtensionTable: false },
  { key: "cluster", name: "Cluster", hasExtensionTable: false },
  { key: "unmanaged_device", name: "Dispositivo no gestionado", hasExtensionTable: false },
] as const;

const BASELINE_DROPDOWN_CATEGORIES = [
  { key: "status", name: "Estado" },
  { key: "manufacturer", name: "Fabricante" },
  { key: "location", name: "Ubicación" },
  { key: "os", name: "Sistema operativo" },
  { key: "os_version", name: "Versión de SO" },
  { key: "network_equipment_type", name: "Tipo de equipo de red" },
  { key: "software_category", name: "Categoría de software" },
  { key: "itil_category", name: "Categoría de ticket/problema/cambio" },
  { key: "project_state", name: "Estado de proyecto" },
  { key: "project_type", name: "Tipo de proyecto" },
  { key: "project_task_state", name: "Estado de tarea de proyecto" },
  { key: "cable_type", name: "Tipo de cable" },
] as const;

const BASELINE_STATUS_ITEMS = ["En uso", "En stock", "Fuera de servicio"];

const FULL_RIGHTS = Object.values(RIGHT).reduce((acc, bit) => acc | bit, 0);

async function main() {
  console.log("Seeding...");

  // 1. Root entity - reuse if one already exists, so re-running the seed is a no-op.
  const [existingRoot] = await db.select().from(entities).where(isNull(entities.parentId));
  const root = existingRoot ?? (await createEntity({ name: "Global" }));
  console.log(`Root entity: ${root.name} (${root.id})`);

  // 2. Admin profile with full rights on every registered module.
  const existingProfiles = await listProfiles();
  const adminProfile =
    existingProfiles.find((p) => p.name === "Super-Admin") ??
    (await createProfile({
      name: "Super-Admin",
      interface: "central",
      description: "Acceso total a todos los módulos",
      isDefault: true,
    }));
  for (const moduleKey of Object.values(MODULE)) {
    await setModuleRight(adminProfile.id, moduleKey, FULL_RIGHTS);
  }
  console.log(`Admin profile: ${adminProfile.name} (${adminProfile.id})`);

  // 3. Admin user.
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@itsm.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const existingUser = await findUserByEmail(email);
  const admin =
    existingUser ??
    (await createUser({
      email,
      username: "admin",
      password,
      displayName: "Administrador",
      defaultEntityId: root.id,
    }));
  console.log(`Admin user: ${admin.email} (${admin.id})`);

  // 4. Assign the admin user to the root entity with the admin profile, as default
  // (skip if this exact assignment already exists, so re-running seed is a no-op).
  const assignments = await listUserProfileAssignments(admin.id);
  const alreadyAssigned = assignments.some((a) => a.entityId === root.id && a.profileId === adminProfile.id);
  if (!alreadyAssigned) {
    await assignUserProfile({
      userId: admin.id,
      profileId: adminProfile.id,
      entityId: root.id,
      isRecursive: true,
      isDefault: true,
    });
  }

  // 5. Core asset definitions (isSystem = true).
  for (const def of CORE_ASSET_DEFINITIONS) {
    const existing = await getAssetDefinitionByKey(def.key);
    if (!existing) {
      await createAssetDefinition({ key: def.key, name: def.name, isSystem: true, hasExtensionTable: def.hasExtensionTable });
    } else if (existing.hasExtensionTable !== def.hasExtensionTable) {
      await updateAssetDefinition(existing.id, { hasExtensionTable: def.hasExtensionTable });
    }
  }
  console.log(`Core asset definitions: ${CORE_ASSET_DEFINITIONS.length} ensured`);

  // 6. Baseline dropdown categories + starter "status" items at the root entity.
  for (const cat of BASELINE_DROPDOWN_CATEGORIES) {
    const existing = await getDropdownCategoryByKey(cat.key);
    if (!existing) {
      await createDropdownCategory({ key: cat.key, name: cat.name, isSystem: true });
    }
  }
  console.log(`Dropdown categories: ${BASELINE_DROPDOWN_CATEGORIES.length} ensured`);

  const statusCategory = await getDropdownCategoryByKey("status");
  if (statusCategory) {
    const existingItems = await listDropdownItems(statusCategory.id, root.id);
    const existingNames = new Set(existingItems.map((i) => i.name));
    for (const name of BASELINE_STATUS_ITEMS) {
      if (!existingNames.has(name)) {
        await createDropdownItem({ categoryId: statusCategory.id, entityId: root.id, name });
      }
    }
  }
  console.log(`Baseline "status" items: ${BASELINE_STATUS_ITEMS.length} ensured`);

  // 7. Default SLA policy (24h to resolve, 1h first response).
  const existingPolicies = await listSlaPolicies(root.id);
  if (!existingPolicies.some((p) => p.name === "Estándar 24/7")) {
    await createSlaPolicy({ entityId: root.id, name: "Estándar 24/7", ttoMinutes: 60, ttrMinutes: 1440 });
  }
  console.log("Default SLA policy ensured");

  // 8. Default notification template (ticket-service.ts queues this when a ticket is solved).
  if (!(await getNotificationTemplateByKey("ticket_solved"))) {
    await createNotificationTemplate({
      key: "ticket_solved",
      name: "Ticket resuelto",
      subjectTemplate: "Tu ticket #{{ticketId}} fue resuelto",
      bodyTemplate: 'Hola, tu ticket "{{ticketTitle}}" fue marcado como resuelto. Si el problema persiste, respóndenos.',
    });
  }
  console.log("Default notification template ensured");

  // 9. Default notification template for saved search alerts (saved-search-service.ts runSavedSearchAlertsSweep queues this).
  if (!(await getNotificationTemplateByKey("saved_search_alert"))) {
    await createNotificationTemplate({
      key: "saved_search_alert",
      name: "Alerta de búsqueda guardada",
      subjectTemplate: "Alerta: {{savedSearchName}}",
      bodyTemplate: 'Tu búsqueda guardada "{{savedSearchName}}" alcanzó {{count}} resultados (umbral: {{threshold}}).',
    });
  }
  console.log("Saved search alert notification template ensured");

  console.log("\nSeed complete.");
  console.log(`Login with: ${email} / ${existingUser ? "(existing password)" : password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
