import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export const loadGoogleMaps = async () => {
  if (typeof window !== 'undefined') {
    setOptions({
      key: API_KEY,
      v: "weekly"
    });
  }

  return Promise.all([
    importLibrary("maps"),
    importLibrary("places"),
    importLibrary("routes"),
    importLibrary("geometry")
  ]);
};

export { importLibrary };
