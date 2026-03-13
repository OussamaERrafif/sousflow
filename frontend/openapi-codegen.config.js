const codegenConfig = {
  schemaFile: "./openapi.json",
  apiFile: "./src/lib/store/apiSlice.ts",
  apiImport: "apiSlice",
  outputFile: "./src/lib/store/generated/api.ts",
  hooks: true,
  flatten: true,
};

module.exports = codegenConfig;
