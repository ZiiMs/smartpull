import {
  exportKeystoneGuruRouteToMdt,
  importKeystoneGuruRoute,
} from "./keystone-guru.ts"

const input = process.argv[2]

if (!input) {
  console.error(
    "Usage: node --experimental-strip-types server/test-keystone-guru-route.ts <keystone-guru-url-or-slug>",
  )
  process.exit(1)
}

const route = await importKeystoneGuruRoute(input)
const mdt = await exportKeystoneGuruRouteToMdt(input)

console.log(
  JSON.stringify(
    {
      name: route.name,
      dungeonKey: route.dungeonKey,
      pullCount: route.pulls.length,
    },
    null,
    2,
  ),
)
console.log("MDT:")
console.log(mdt)
