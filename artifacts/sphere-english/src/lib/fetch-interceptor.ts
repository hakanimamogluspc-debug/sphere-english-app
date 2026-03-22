// This intercepts all fetch calls globally to inject the auth token.
// It ensures that generated Orval hooks automatically authenticate without modifying them.

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  let [resource, config] = args;
  
  const token = localStorage.getItem("sphere_token");
  
  if (token) {
    config = config || {};
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`
    };
  }
  
  return originalFetch(resource, config);
};

export {};
