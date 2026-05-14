#include <string>
#include <map>

namespace biyahe {

class FareMatrix {
public:
    static float calculateFare(const std::string& mode, float distanceKm) {
        if (mode == "rail") {
            return 15.0f + (distanceKm * 1.5f);
        } else if (mode == "brt") {
            return 13.0f;
        }
        return 12.0f; // Base jeepney fare
    }
};

} // namespace biyahe
