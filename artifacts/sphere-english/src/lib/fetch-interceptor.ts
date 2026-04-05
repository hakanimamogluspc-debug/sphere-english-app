const originalFetch = window.fetch;

window.fetch = async (...args) => {
  let [resource, config] = args;

  const existingHeaders =
    config?.headers instanceof Headers
      ? Object.fromEntries((config.headers as Headers).entries())
      : (config?.headers as Record<string, string>) || {};

  // Only add token from localStorage if Authorization not already set
  if (!existingHeaders["authorization"] && !existingHeaders["Authorization"]) {
    try {
      const token = localStorage.getItem("sphere_token");
      if (token) {
        config = config || {};
        config.headers = { ...existingHeaders, Authorization: `Bearer ${token}` };
      }
    } catch { /* localStorage blocked in some iframe contexts — token provided via setAuthTokenGetter */ }
  }

  return originalFetch(resource, config);
};

export {};
