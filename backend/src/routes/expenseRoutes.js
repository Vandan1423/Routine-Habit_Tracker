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
import { validate } from "../middlewares/validationMiddleware.js";
import { idParam } from "../Schema/CommonSchema.js";
import {
    createSubscriptionSchema,
    createTransactionSchema,
    monthQuerySchema,
    placesQuerySchema,
    updateAccountSchema,
    updateSubscriptionSchema,
    updateTransactionSchema,
    upsertBudgetSchema,
} from "../Schema/ExpenseSchema.js";

const router = express.Router();

router.use(protect);

router.get("/summary", validate({ query: monthQuerySchema }), getSummary);
router.get("/accounts", getAccounts);
router.put("/accounts/:id", validate({ params: idParam, body: updateAccountSchema }), updateAccount);
router.get("/transactions", validate({ query: monthQuerySchema }), listTransactions);
router.post("/transactions", validate({ body: createTransactionSchema }), createTransaction);
router.put("/transactions/:id", validate({ params: idParam, body: updateTransactionSchema }), updateTransaction);
router.delete("/transactions/:id", validate({ params: idParam }), deleteTransaction);
router.get("/subscriptions", listSubscriptions);
router.post("/subscriptions", validate({ body: createSubscriptionSchema }), createSubscription);
router.put("/subscriptions/:id", validate({ params: idParam, body: updateSubscriptionSchema }), updateSubscription);
router.delete("/subscriptions/:id", validate({ params: idParam }), deleteSubscription);
router.get("/places", validate({ query: placesQuerySchema }), listKnownPlaces);
router.get("/budgets", listBudgets);
router.post("/budgets", validate({ body: upsertBudgetSchema }), upsertBudget);
router.get("/export", validate({ query: monthQuerySchema }), exportMonthlyCsv);

export default router;