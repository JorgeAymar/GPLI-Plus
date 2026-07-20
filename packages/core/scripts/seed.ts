import "dotenv/config";
import { db, entities } from "@itsm/db";
import { isNull } from "drizzle-orm";
import { ASSET_DEFINITION_KEY } from "../src/assets/asset-definition-keys";
import { createAssetDefinition, getAssetDefinitionByKey, updateAssetDefinition } from "../src/assets/asset-definition-service";
import { MODULE } from "../src/auth/modules";
import { RIGHT } from "../src/auth/permissions";
import { DROPDOWN_CATEGORY } from "../src/dropdowns/dropdown-categories";
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
  { key: ASSET_DEFINITION_KEY.COMPUTER, name: "Computadora", hasExtensionTable: true },
  { key: ASSET_DEFINITION_KEY.MONITOR, name: "Monitor", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.NETWORK_EQUIPMENT, name: "Equipo de red", hasExtensionTable: true },
  { key: ASSET_DEFINITION_KEY.PRINTER, name: "Impresora", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.PHONE, name: "Teléfono", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.PERIPHERAL, name: "Periférico", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.DATACENTER, name: "Datacenter", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.DOMAIN, name: "Dominio", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.LINE, name: "Línea", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.DATABASE, name: "Base de datos", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.RACK, name: "Rack", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.ENCLOSURE, name: "Chasis/Enclosure", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.PDU, name: "PDU", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.CLUSTER, name: "Cluster", hasExtensionTable: false },
  { key: ASSET_DEFINITION_KEY.UNMANAGED_DEVICE, name: "Dispositivo no gestionado", hasExtensionTable: false },
] as const;

const BASELINE_DROPDOWN_CATEGORIES = [
  { key: DROPDOWN_CATEGORY.STATUS, name: "Estado" },
  { key: DROPDOWN_CATEGORY.MANUFACTURER, name: "Fabricante" },
  { key: DROPDOWN_CATEGORY.LOCATION, name: "Ubicación" },
  { key: DROPDOWN_CATEGORY.OS, name: "Sistema operativo" },
  { key: DROPDOWN_CATEGORY.OS_VERSION, name: "Versión de SO" },
  { key: DROPDOWN_CATEGORY.NETWORK_EQUIPMENT_TYPE, name: "Tipo de equipo de red" },
  { key: DROPDOWN_CATEGORY.SOFTWARE_CATEGORY, name: "Categoría de software" },
  { key: DROPDOWN_CATEGORY.ITIL_CATEGORY, name: "Categoría de ticket/problema/cambio" },
  { key: DROPDOWN_CATEGORY.PROJECT_STATE, name: "Estado de proyecto" },
  { key: DROPDOWN_CATEGORY.PROJECT_TYPE, name: "Tipo de proyecto" },
  { key: DROPDOWN_CATEGORY.PROJECT_TASK_STATE, name: "Estado de tarea de proyecto" },
  { key: DROPDOWN_CATEGORY.CABLE_TYPE, name: "Tipo de cable" },
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

  const statusCategory = await getDropdownCategoryByKey(DROPDOWN_CATEGORY.STATUS);
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

  // 10. Default notification template for password reset (auth.actions.ts requestPasswordResetAction queues this).
  if (!(await getNotificationTemplateByKey("password_reset"))) {
    await createNotificationTemplate({
      key: "password_reset",
      name: "Recuperación de contraseña",
      subjectTemplate: "Recuperá tu contraseña de GLPI-Plus",
      bodyTemplate:
        "Hacé clic en el siguiente link para elegir una contraseña nueva (válido por 1 hora):\n\n{{resetLink}}\n\nSi no solicitaste este cambio, podés ignorar este correo - tu contraseña actual sigue siendo válida.",
    });
  }
  console.log("Password reset notification template ensured");

  console.log("\nSeed complete.");
  console.log(`Login with: ${email} / ${existingUser ? "(existing password)" : password}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
