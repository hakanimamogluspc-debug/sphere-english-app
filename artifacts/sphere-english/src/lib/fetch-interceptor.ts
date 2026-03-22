const originalFetch = window.fetch;

window.fetch = async (...args) => {
  let [resource, config] = args;
  
  const token = localStorage.getItem("sphere_token");
  
  if (token) {
    config = config || {};

    const existing =
      config.headers instanceof Headers
        ? Object.fromEntries((config.headers as Headers).entries())
        : (config.headers as Record<string, string>) || {};

    config.headers = {
      ...existing,
      Authorization: `Bearer ${token}`,
    };
  }
  
  return originalFetch(resource, config);
};

export {};
