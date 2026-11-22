import assert from "node:assert/strict";
import test from "node:test";
import { handoffLoginReturnTo, parseAgentHandoffFragment, restoreAgentHandoffAfterLogin, saveAgentHandoffForLogin } from "./agentHandoff.js";

test("handoff fragment requires exactly one ref and one state", () => {
  assert.deepEqual(parseAgentHandoffFragment("#request_ref=abc&state=xyz"), { requestRef: "abc", state: "xyz" });
  for (const fragment of ["#request_ref=abc", "#request_ref=abc&state=", "#request_ref=a&request_ref=b&state=x", "#request_ref=a&state=x&extra=1", "#request_ref=abc%2Fdef&state=x"]) {
    assert.equal(parseAgentHandoffFragment(fragment), null, fragment);
  }
});

test("login return path never sends the fragment to Login", () => {
  const location = { pathname: "/agent-handoff", search: "", hash: "#request_ref=abc&state=xyz" };
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), getItem: (key) => values.get(key), removeItem: (key) => values.delete(key) };
  assert.equal(saveAgentHandoffForLogin(location, storage, 1000), true);
  assert.equal(handoffLoginReturnTo(location), "/agent-handoff");
  let restoredURL = "";
  const history = { state: null, replaceState: (_state, _title, url) => { restoredURL = url; } };
  assert.equal(restoreAgentHandoffAfterLogin({ pathname: "/agent-handoff", hash: "" }, storage, history, 2000), location.hash);
  assert.equal(restoredURL, "/agent-handoff#request_ref=abc&state=xyz");
  assert.equal(restoreAgentHandoffAfterLogin({ pathname: "/agent-handoff", hash: "" }, storage, history, 2001), "");
  saveAgentHandoffForLogin(location, storage, 1000);
  assert.equal(restoreAgentHandoffAfterLogin({ pathname: "/agent-handoff", hash: "" }, storage, history, 301000), "");
  assert.equal(saveAgentHandoffForLogin(location, null, 1000), false);
  assert.equal(restoreAgentHandoffAfterLogin({ pathname: "/agent-handoff", hash: "" }, null, history, 2000), "");
});
