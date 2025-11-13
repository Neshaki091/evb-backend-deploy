const express = require("express");
const router = express.Router();

// SỬA 1: Chỉ import controller object, không import lẻ
const listingController = require("../controllers/controllerslisting.controller");
const { authmiddleware } = require("../shared/authmiddleware");

// --- PUBLIC & CƠ BẢN ---
// SỬA 2: Dùng listingController.functionName cho nhất quán
router.get("/public", listingController.getPublicListings);
router.get("/my", authmiddleware, listingController.getListingsByOwner);
router.get("/:id", authmiddleware, listingController.getListingById);

// --- CHỨC NĂNG NGƯỜI DÙNG ---

// === BỔ SUNG: Route cho AI Gợi ý giá ===
router.post("/suggest-price", authmiddleware, listingController.suggestPrice);

router.post("/", authmiddleware, listingController.createListing);
router.put("/:id", authmiddleware, listingController.updateListing);
router.delete("/:id", authmiddleware, listingController.deleteListing);

// --- CHỨC NĂNG ADMIN ---
// SỬA 2: Dùng listingController.functionName
router.get("/", authmiddleware, listingController.getAllListings);
router.put(
    "/:id/approve",
    authmiddleware,
    listingController.approveListing
);
router.put(
    "/:id/verify",
    authmiddleware,
    listingController.verifyListing
);
router.put(
    "/:id/status",
    authmiddleware,
    listingController.updateListingStatus
);


module.exports = router;