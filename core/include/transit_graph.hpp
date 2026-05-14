#ifndef TRANSIT_GRAPH_HPP
#define TRANSIT_GRAPH_HPP

#include <string>
#include <vector>
#include <map>
#include <cmath>

namespace biyahe {

struct Station {
    std::string id;
    std::string name;
    double lat;
    double lon;
    std::vector<std::string> lines;
    std::string zone;
};

struct Transfer {
    std::string from;
    std::string to;
    int walkMin;
    double distance;
};

struct RouteDefinition {
    std::string id;
    std::string name;
    std::string color;
    std::string mode;
    std::vector<std::string> stops;
    double avgSpeedKmh;
    int dwellTimeSec;
    double baseFare;
    double perKmRate;
    int headwayPeak;
    int headwayOffPeak;
};

class TransitGraph {
public:
    static double haversine(double lat1, double lon1, double lat2, double lon2);

    TransitGraph();
    void loadData();

    const Station* getStation(const std::string& id) const;
    std::vector<std::string> getAllStationIds() const;
    std::vector<Transfer> getTransfersFrom(const std::string& stationId) const;

    const std::map<std::string, RouteDefinition>& getRoutes() const { return routes; }

private:
    std::map<std::string, Station> stations;
    std::map<std::string, RouteDefinition> routes;
    std::vector<Transfer> transfers;

    void addStation(const std::string& id, const std::string& name, double lat, double lon, std::string zone);
    void addRoute(const std::string& id, const std::string& name, const std::string& color, const std::string& mode, std::vector<std::string> stops, double speed);
    void addTransfer(const std::string& from, const std::string& to, int min, double dist);
};

} // namespace biyahe

#endif // TRANSIT_GRAPH_HPP
