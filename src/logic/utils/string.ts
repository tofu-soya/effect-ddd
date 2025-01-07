export function toSnakeCase(str: string): string {
  return str
    .replace(/[\s]+/g, '_') // Replace spaces with underscores
    .replace(/([a-z])([A-Z])/g, '$1_$2') // Add underscores between camel case
    .replace(/[-]+/g, '_') // Replace hyphens with underscores
    .replace(/[^a-zA-Z0-9_]+/g, '') // Remove non-alphanumeric characters
    .toLowerCase(); // Convert to lowercase
}
