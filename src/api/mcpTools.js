export async function listMcpToolNames(endpoint, token, fetchImpl = fetch) {
  if (!token) throw new Error("令牌已关闭，请重新签发后验证");
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
  } catch {
    throw new Error("MCP 工具发现请求失败，请检查网络后重试");
  }
  if (!response.ok) throw new Error(`MCP 工具发现失败（HTTP ${response.status}）`);
  let envelope;
  try {
    envelope = await response.json();
  } catch {
    throw new Error("MCP 工具发现返回了无效响应");
  }
  if (envelope?.error || !Array.isArray(envelope?.result?.tools)) {
    throw new Error("MCP 工具发现返回了无效工具清单");
  }
  return envelope.result.tools
    .map((tool) => tool?.name)
    .filter((name) => typeof name === "string" && name.startsWith("model_publish."));
}
