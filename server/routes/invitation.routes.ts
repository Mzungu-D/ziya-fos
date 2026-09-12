import express from "express";
import {
  getInvitation,
  acceptInvitation,
} from "../controllers/invitation.controller";

const router = express.Router();

/*
 * Public invitation endpoints.
 *
 * The invitation token itself is the credential used to
 * access these endpoints. Authentication middleware must
 * NOT be applied here because invited users do not have
 * an account/session yet.
 */

router.get("/:token", getInvitation);

router.post("/:token/accept", acceptInvitation);

export default router;
