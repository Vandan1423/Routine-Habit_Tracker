import "../helpers/env.js";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import mongoose from "mongoose";

import { OWNED_MODELS } from "../../src/utils/eraseAccount.js";

// Deleting an account removes what is listed in OWNED_MODELS. A model added later that keeps a person's
// data and is left off that list would be left behind, so the list is checked against the models themselves.

describe("erasing an account", () => {
    it("covers every model that names an owner", async () => {
        const folder = new URL("../../src/models/", import.meta.url);
        await Promise.all(
            readdirSync(folder)
                .filter((file) => file.endsWith(".js"))
                .map((file) => import(new URL(file, folder))),
        );

        const owned = Object.values(mongoose.models)
            .filter((model) => model.modelName !== "User" && model.schema.path("user"))
            .map((model) => model.modelName)
            .sort();

        assert.deepEqual(OWNED_MODELS.map((model) => model.modelName).sort(), owned);
    });

    it("leaves no model without an owner unaccounted for", () => {
        const unowned = Object.values(mongoose.models)
            .filter((model) => !model.schema.path("user"))
            .map((model) => model.modelName);

        // The account itself is removed by eraseAccount after what it owns
        assert.deepEqual(unowned, ["User"]);
    });
});
