"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({
    transactionOptions: {
        maxWait: 10000, // Maximum wait time for a transaction
        timeout: 10000, // Maximum time to run a transaction
    },
});
exports.default = prisma;
