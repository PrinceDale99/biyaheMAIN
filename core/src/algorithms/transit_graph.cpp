#include "../../include/transit_graph.hpp"
#include <algorithm>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace biyahe {

double TransitGraph::haversine(double lat1, double lon1, double lat2, double lon2) {
    const double R = 6371.0;
    double dLat = (lat2 - lat1) * M_PI / 180.0;
    double dLon = (lon2 - lon1) * M_PI / 180.0;
    double a = std::sin(dLat / 2.0) * std::sin(dLat / 2.0) +
               std::cos(lat1 * M_PI / 180.0) * std::cos(lat2 * M_PI / 180.0) *
               std::sin(dLon / 2.0) * std::sin(dLon / 2.0);
    return R * 2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));
}

TransitGraph::TransitGraph() {
    loadData();
}

void TransitGraph::loadData() {
    // LRT-1 Stations (North to South)
    addStation("lrt1-roosevelt", "Fernando Poe Jr.", 14.6575, 121.0210, "north");
    addStation("lrt1-balintawak", "Balintawak", 14.6574, 121.0040, "north");
    addStation("lrt1-monumento", "Monumento", 14.6545, 120.9838, "north");
    addStation("lrt1-5th-ave", "5th Avenue", 14.6445, 120.9836, "north");
    addStation("lrt1-r-papa", "R. Papa", 14.6360, 120.9825, "north");
    addStation("lrt1-abad-santos", "Abad Santos", 14.6300, 120.9818, "north");
    addStation("lrt1-blumentritt", "Blumentritt", 14.6227, 120.9828, "north");
    addStation("lrt1-tayuman", "Tayuman", 14.6167, 120.9825, "central");
    addStation("lrt1-bambang", "Bambang", 14.6110, 120.9822, "central");
    addStation("lrt1-doroteo-jose", "Doroteo Jose", 14.6054, 120.9822, "central");
    addStation("lrt1-carriedo", "Carriedo", 14.5980, 120.9815, "central");
    addStation("lrt1-central", "Central Terminal", 14.5927, 120.9818, "central");
    addStation("lrt1-un-ave", "United Nations", 14.5824, 120.9845, "central");
    addStation("lrt1-pedro-gil", "Pedro Gil", 14.5760, 120.9880, "central");
    addStation("lrt1-quirino", "Quirino", 14.5700, 120.9915, "central");
    addStation("lrt1-vito-cruz", "Vito Cruz", 14.5633, 120.9947, "central");
    addStation("lrt1-gil-puyat", "Gil Puyat", 14.5543, 120.9972, "central");
    addStation("lrt1-libertad", "Libertad", 14.5475, 120.9986, "south");
    addStation("lrt1-edsa", "EDSA", 14.5390, 121.0005, "south");
    addStation("lrt1-baclaran", "Baclaran", 14.5342, 120.9986, "south");

    // LRT-2 Stations (West to East)
    addStation("lrt2-recto", "Recto", 14.6033, 120.9833, "central");
    addStation("lrt2-legarda", "Legarda", 14.6008, 120.9925, "central");
    addStation("lrt2-pureza", "Pureza", 14.6015, 121.0050, "central");
    addStation("lrt2-v-mapa", "V. Mapa", 14.6042, 121.0175, "central");
    addStation("lrt2-j-ruiz", "J. Ruiz", 14.6105, 121.0263, "east");
    addStation("lrt2-gilmore", "Gilmore", 14.6135, 121.0340, "east");
    addStation("lrt2-betty-go", "Betty Go-Belmonte", 14.6185, 121.0425, "east");
    addStation("lrt2-cubao", "Araneta Center-Cubao", 14.6225, 121.0530, "east");
    addStation("lrt2-anonas", "Anonas", 14.6280, 121.0650, "east");
    addStation("lrt2-katipunan", "Katipunan", 14.6315, 121.0730, "east");
    addStation("lrt2-santolan", "Santolan", 14.6218, 121.0860, "east");
    addStation("lrt2-marikina", "Marikina-Pasig", 14.6190, 121.1000, "east");
    addStation("lrt2-antipolo", "Antipolo", 14.6248, 121.1210, "east");

    // MRT-3 Stations (North to South)
    addStation("mrt3-north", "North Avenue", 14.6527, 121.0330, "north");
    addStation("mrt3-quezon", "Quezon Avenue", 14.6425, 121.0385, "north");
    addStation("mrt3-gma", "GMA-Kamuning", 14.6350, 121.0430, "north");
    addStation("mrt3-cubao", "Araneta Center-Cubao", 14.6190, 121.0530, "east");
    addStation("mrt3-santolan", "Santolan-Annapolis", 14.6075, 121.0560, "east");
    addStation("mrt3-ortigas", "Ortigas", 14.5880, 121.0570, "east");
    addStation("mrt3-shaw", "Shaw Boulevard", 14.5815, 121.0535, "east");
    addStation("mrt3-boni", "Boni", 14.5735, 121.0480, "east");
    addStation("mrt3-guadalupe", "Guadalupe", 14.5670, 121.0455, "central");
    addStation("mrt3-buendia", "Buendia", 14.5540, 121.0340, "central");
    addStation("mrt3-ayala", "Ayala", 14.5494, 121.0278, "central");
    addStation("mrt3-magallanes", "Magallanes", 14.5420, 121.0190, "south");
    addStation("mrt3-taft", "Taft Avenue", 14.5375, 121.0010, "south");

    // EDSA Carousel Stations (North to South)
    addStation("edsa-monumento", "Monumento (Carousel)", 14.6545, 120.9838, "north");
    addStation("edsa-bagong-barrio", "Bagong Barrio", 14.6570, 120.9910, "north");
    addStation("edsa-balintawak", "Balintawak (Carousel)", 14.6574, 121.0040, "north");
    addStation("edsa-roosevelt", "Roosevelt (Carousel)", 14.6575, 121.0210, "north");
    addStation("edsa-north", "North Avenue (Carousel)", 14.6527, 121.0330, "north");
    addStation("edsa-quezon", "Quezon Avenue (Carousel)", 14.6425, 121.0385, "north");
    addStation("edsa-nepa", "Nepa Q-Mart", 14.6280, 121.0480, "north");
    addStation("edsa-main", "Main Avenue", 14.6120, 121.0550, "east");
    addStation("edsa-santolan", "Santolan (Carousel)", 14.6075, 121.0560, "east");
    addStation("edsa-ortigas", "Ortigas (Carousel)", 14.5880, 121.0570, "east");
    addStation("edsa-guadalupe", "Guadalupe (Carousel)", 14.5670, 121.0455, "central");
    addStation("edsa-buendia", "Buendia (Carousel)", 14.5540, 121.0340, "central");
    addStation("edsa-ayala", "Ayala (Carousel)", 14.5494, 121.0278, "central");
    addStation("edsa-taft", "Taft Avenue (Carousel)", 14.5375, 121.0010, "south");
    addStation("edsa-macapagal", "Macapagal", 14.5300, 120.9900, "south");
    addStation("edsa-pitx", "PITX", 14.5100, 120.9900, "south");

    // Routes
    addRoute("lrt1", "LRT Line 1", "#2E7D32", "rail", 
             {"lrt1-roosevelt", "lrt1-balintawak", "lrt1-monumento", "lrt1-5th-ave", "lrt1-r-papa", "lrt1-abad-santos", "lrt1-blumentritt", "lrt1-tayuman", "lrt1-bambang", "lrt1-doroteo-jose", "lrt1-carriedo", "lrt1-central", "lrt1-un-ave", "lrt1-pedro-gil", "lrt1-quirino", "lrt1-vito-cruz", "lrt1-gil-puyat", "lrt1-libertad", "lrt1-edsa", "lrt1-baclaran"}, 30.0);
    
    addRoute("lrt2", "LRT Line 2", "#7B1FA2", "rail", 
             {"lrt2-recto", "lrt2-legarda", "lrt2-pureza", "lrt2-v-mapa", "lrt2-j-ruiz", "lrt2-gilmore", "lrt2-betty-go", "lrt2-cubao", "lrt2-anonas", "lrt2-katipunan", "lrt2-santolan", "lrt2-marikina", "lrt2-antipolo"}, 35.0);

    addRoute("mrt3", "MRT-3", "#1565C0", "rail", 
             {"mrt3-north", "mrt3-quezon", "mrt3-gma", "mrt3-cubao", "mrt3-santolan", "mrt3-ortigas", "mrt3-shaw", "mrt3-boni", "mrt3-guadalupe", "mrt3-buendia", "mrt3-ayala", "mrt3-magallanes", "mrt3-taft"}, 25.0);

    addRoute("edsa-carousel", "EDSA Carousel", "#F57F17", "bus",
             {"edsa-monumento", "edsa-bagong-barrio", "edsa-balintawak", "edsa-roosevelt", "edsa-north", "edsa-quezon", "edsa-nepa", "edsa-main", "edsa-santolan", "edsa-ortigas", "edsa-guadalupe", "edsa-buendia", "edsa-ayala", "edsa-taft", "edsa-macapagal", "edsa-pitx"}, 20.0);

    // Transfers
    // LRT1 <-> LRT2
    addTransfer("lrt1-doroteo-jose", "lrt2-recto", 5, 0.3, "footbridge", 0.9);
    // LRT2 <-> MRT3
    addTransfer("lrt2-cubao", "mrt3-cubao", 8, 0.4, "overpass", 0.9);
    // LRT1 <-> MRT3
    addTransfer("mrt3-taft", "lrt1-edsa", 6, 0.3, "footbridge", 0.9);
    addTransfer("lrt1-roosevelt", "mrt3-north", 12, 0.8, "walk", 0.4); // Long walk on road/sidewalk
    
    // EDSA Carousel Transfers
    addTransfer("lrt1-monumento", "edsa-monumento", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("lrt1-balintawak", "edsa-balintawak", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("lrt1-roosevelt", "edsa-roosevelt", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("mrt3-north", "edsa-north", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("mrt3-quezon", "edsa-quezon", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("mrt3-santolan", "edsa-santolan", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("mrt3-ortigas", "edsa-ortigas", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("mrt3-guadalupe", "edsa-guadalupe", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("mrt3-buendia", "edsa-buendia", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("mrt3-ayala", "edsa-ayala", 3, 0.1, "pedestrian_lane", 0.8);
    addTransfer("mrt3-taft", "edsa-taft", 3, 0.1, "pedestrian_lane", 0.8);
}

void TransitGraph::addStation(const std::string& id, const std::string& name, double lat, double lon, std::string zone) {
    stations[id] = {id, name, lat, lon, {}, zone};
}

void TransitGraph::addRoute(const std::string& id, const std::string& name, const std::string& color, const std::string& mode, std::vector<std::string> stops, double speed) {
    routes[id] = {id, name, color, mode, stops, speed, 30, 15.0, 1.5, 5, 10};
}

void TransitGraph::addTransfer(const std::string& from, const std::string& to, int min, double dist, const std::string& infra, double safety) {
    transfers.push_back({from, to, min, dist, infra, safety});
    transfers.push_back({to, from, min, dist, infra, safety});
}

const Station* TransitGraph::getStation(const std::string& id) const {
    auto it = stations.find(id);
    if (it != stations.end()) return &it->second;
    return nullptr;
}

std::vector<std::string> TransitGraph::getAllStationIds() const {
    std::vector<std::string> ids;
    for (const auto& pair : stations) ids.push_back(pair.first);
    return ids;
}

std::vector<Transfer> TransitGraph::getTransfersFrom(const std::string& stationId) const {
    std::vector<Transfer> results;
    for (const auto& t : transfers) {
        if (t.from == stationId) results.push_back(t);
    }
    return results;
}

} // namespace biyahe
