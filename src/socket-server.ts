// The pre-authentication permissive Socket.IO server was retired.
// The only supported legacy realtime executable is socket-server.cjs,
// where Clerk JWTs, Origin and PostgreSQL room/widget policies are checked.
// Keep a non-executable module rather than an unsafe second server.
export {};
