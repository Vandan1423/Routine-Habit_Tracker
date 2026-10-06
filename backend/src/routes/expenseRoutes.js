import express from "express";
import {
    createSubscription,
    createTransaction,
    deleteSubscription,
    deleteTransaction,
    exportMonthlyCsv,
    getAccounts,
    getSummary,
    listBudgets,
    listKnownPlaces,
    listSubscriptions,
    listTransactions,
    updateAccount,
    updateTransaction,
    updateSubscription,
    upsertBudget,
} from "../controllers/expenseController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/summary", getSummary);
router.get("/accounts", getAccounts);
router.put("/accounts/:id", updateAccount);
router.get("/transactions", listTransactions);
router.post("/transactions", createTransaction);
router.put("/transactions/:id", updateTransaction);
router.delete("/transactions/:id", deleteTransaction);
router.get("/subscriptions", listSubscriptions);
router.post("/subscriptions", createSubscription);
router.put("/subscriptions/:id", updateSubscription);
router.delete("/subscriptions/:id", deleteSubscription);
router.get("/places", listKnownPlaces);
router.get("/budgets", listBudgets);
router.post("/budgets", upsertBudget);
router.get("/export", exportMonthlyCsv);

export default router;