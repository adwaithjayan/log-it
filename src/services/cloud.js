import AsyncStorage from "@react-native-async-storage/async-storage";

// Using JSONBlob.com (Free, no auth required, simple JSON store)
const API_URL = "https://jsonblob.com/api/jsonBlob";
const CUSTOM_SYNC_ID_KEY = "gym_tracker_sync_id";

// Get local Sync ID
export const getLocalSyncId = async () => {
  return await AsyncStorage.getItem(CUSTOM_SYNC_ID_KEY);
};

// Set local Sync ID (e.g. after user manually enters one)
export const setLocalSyncId = async (id) => {
  // Basic validation: UUID-like string
  if (!id || id.length < 10) return false;
  await AsyncStorage.setItem(CUSTOM_SYNC_ID_KEY, id);
  return true;
};

// Upload Data (Create or Update)
// Returns { success: true, syncId: "..." }
export const uploadDataToCloud = async (data) => {
  try {
    let syncId = await getLocalSyncId();
    let url = API_URL;
    let method = "POST";

    if (syncId) {
      // Update existing blob
      url = `${API_URL}/${syncId}`;
      method = "PUT";
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error("Upload failed status:", response.status);
      return { success: false };
    }

    // If we created a new one, we get the Location header UUID
    if (method === "POST") {
      const locationHeader = response.headers.get("Location");
      if (locationHeader) {
        // Extract UUID from URL
        syncId = locationHeader.split("/").pop();
        await setLocalSyncId(syncId);
      }
    }

    return { success: true, syncId };
  } catch (error) {
    console.error("Cloud Upload Error:", error);
    return { success: false, error };
  }
};

// Download Data
// Returns { success: true, data: Object }
export const downloadDataFromCloud = async (manualSyncId = null) => {
  try {
    const syncId = manualSyncId || (await getLocalSyncId());

    if (!syncId) {
      return { success: false, error: "No Sync ID found" };
    }

    const url = `${API_URL}/${syncId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return { success: false, error: "Cloud data not found" };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Cloud Download Error:", error);
    return { success: false, error };
  }
};
