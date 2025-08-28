/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as agents from "../agents.js";
import type * as crons from "../crons.js";
import type * as executions from "../executions.js";
import type * as maintenance from "../maintenance.js";
import type * as migrations_resetUsers from "../migrations/resetUsers.js";
import type * as projects from "../projects.js";
import type * as users from "../users.js";
import type * as utils_base from "../utils/base.js";
import type * as utils_schemas from "../utils/schemas.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  crons: typeof crons;
  executions: typeof executions;
  maintenance: typeof maintenance;
  "migrations/resetUsers": typeof migrations_resetUsers;
  projects: typeof projects;
  users: typeof users;
  "utils/base": typeof utils_base;
  "utils/schemas": typeof utils_schemas;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
