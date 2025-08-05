const fs = require('fs');
const path = require('path');

// Input schema file
const inputFile = path.join(__dirname, 'schema.prisma');

// Output folders
const outputDir = path.join(__dirname, 'schema');
const modelsDir = path.join(outputDir, 'models');
const enumsDir = path.join(outputDir, 'enums');
const baseFile = path.join(outputDir, 'base.prisma');

// Ensure directories exist
fs.mkdirSync(modelsDir, { recursive: true });
fs.mkdirSync(enumsDir, { recursive: true });

// Read full schema
const schema = fs.readFileSync(inputFile, 'utf8');

// Separate out generator & datasource
const baseBlocks = schema.match(/(generator|datasource)[\s\S]+?\}/g) || [];
fs.writeFileSync(baseFile, baseBlocks.join('\n\n') + '\n');

// Extract and write each model
const modelRegex = /model\s+(\w+)\s+\{[\s\S]+?\}/g;
let match;
while ((match = modelRegex.exec(schema)) !== null) {
  const modelName = match[1];
  const modelBlock = match[0];
  const modelFile = path.join(modelsDir, `${modelName}.prisma`);
  fs.writeFileSync(modelFile, modelBlock + '\n');
}

// Extract and write each enum
const enumRegex = /enum\s+(\w+)\s+\{[\s\S]+?\}/g;
while ((match = enumRegex.exec(schema)) !== null) {
  const enumName = match[1];
  const enumBlock = match[0];
  const enumFile = path.join(enumsDir, `${enumName}.prisma`);
  fs.writeFileSync(enumFile, enumBlock + '\n');
}

console.log('✅ Schema split complete!');

// node prisma/split-schema.js

