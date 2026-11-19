// Deletes the synthetic auth user (profile and remaining rows cascade). Run after the SQL cleanup in the report.
import { admin, readState } from './lib.mjs'
const st = readState()
const { error } = await admin().auth.admin.deleteUser(st.userId)
if (error) throw error
console.log('deleted auth user', st.userId)
