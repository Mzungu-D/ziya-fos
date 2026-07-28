import express from "express";

import {
  getCurrentOrganization,
  getOrganizations,
  switchOrganization,
} from "../controllers/organization.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

const router = express.Router();

/* =========================================================
   ALL ORGANIZATION WORKSPACE ROUTES REQUIRE AUTHENTICATION
========================================================= */

router.use(authenticate);

/* =========================================================
   GET ORGANIZATIONS AVAILABLE TO CURRENT USER
========================================================= */

router.get(
  "/",
  getOrganizations
);

/* =========================================================
   GET CURRENT ORGANIZATION

   Keep before /:id routes if those are added later.
========================================================= */

router.get(
  "/current",
  getCurrentOrganization
);

/* =========================================================
   SWITCH ACTIVE ORGANIZATION
========================================================= */

router.post(
  "/switch",
  switchOrganization
);

export default router;