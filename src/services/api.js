export const fetchExerciseImage = async (exerciseName) => {
  try {
    // Use the search endpoint which allows fuzzy matching and returns image paths
    const searchUrl = `https://wger.de/api/v2/exercise/search/?term=${encodeURIComponent(
      exerciseName.trim()
    )}`;
    const response = await fetch(searchUrl);

    if (!response.ok) return null;

    const data = await response.json();

    if (data.suggestions && data.suggestions.length > 0) {
      // Find the first suggestion that has an image
      const matchWithImage = data.suggestions.find(
        (s) => s.data && s.data.image
      );

      if (matchWithImage) {
        // Wger returns relative paths, so prepend the domain
        return `https://wger.de${matchWithImage.data.image}`;
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching exercise image:", error);
    return null;
  }
};

const getWgerImageForId = async (id) => {
  try {
    const url = `https://wger.de/api/v2/exerciseimage/?exercise=${id}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].image;
    }
  } catch (e) {
    // ignore
  }
  return null;
};
