#include "mcraptor.hpp"
#include <algorithm>
#include <iostream>

namespace biyahe {

McRAPTOR::McRAPTOR() : graph() {}
std::vector<Label> McRAPTOR::query(const std::string &origin,
                                   const std::string &destination,
                                   int departureTimeSec) {
  std::map<int, std::map<std::string, std::vector<Label>>> bags;
  std::set<std::string> markedStops;
  bags[0][origin].push_back({departureTimeSec, 0, 0, 0, "", "", "", nullptr});
  markedStops.insert(origin);
  auto initialTransfers = graph.getTransfersFrom(origin);
  for (const auto &t : initialTransfers) {
    Label walkLabel = {departureTimeSec + t.walkMin * 60,
                       0,
                       0,
                       (float)t.distance,
                       "walk",
                       origin,
                       t.to,
                       std::make_shared<Label>(bags[0][origin][0])};
    addLabel(bags[0][t.to], walkLabel);
    markedStops.insert(t.to);
  }
  for (int k = 1; k <= MAX_ROUNDS; ++k) {
    std::set<std::string> newMarked;
    for (const auto &routePair : graph.getRoutes()) {
      const auto &route = routePair.second;
      std::vector<std::pair<Label, int>> activeLabels;
      for (size_t i = 0; i < route.stops.size(); ++i) {
        const std::string &stopId = route.stops[i];
        for (auto &al : activeLabels) {
          const auto &fromStation = graph.getStation(route.stops[al.second]);
          const auto &toStation = graph.getStation(stopId);
          if (fromStation && toStation) {
            double dist =
                TransitGraph::haversine(fromStation->lat, fromStation->lon,
                                        toStation->lat, toStation->lon);
            int travelTime = (int)((dist / route.avgSpeedKmh) * 3600);
            Label newLabel = al.first;
            newLabel.arrivalTime += travelTime + route.dwellTimeSec;
            newLabel.cost += (float)(dist * route.perKmRate);
            newLabel.transfers = k;
            newLabel.routeId = route.id;
            newLabel.alightStop = stopId;
            newLabel.prevLabel = std::make_shared<Label>(al.first);
            if (addLabel(bags[k][stopId], newLabel)) {
              newMarked.insert(stopId);
            }
          }
        }

        // Check if we can board here
        if (markedStops.count(stopId)) {
          for (const auto &l : bags[k - 1][stopId]) {
            activeLabels.push_back({l, (int)i});
          }
        }
      }
    }

    // Step 2: Walking transfers
    std::set<std::string> transferOrigins = newMarked;
    for (const auto &stopId : transferOrigins) {
      auto transfers = graph.getTransfersFrom(stopId);
      for (const auto &t : transfers) {
        for (const auto &l : bags[k][stopId]) {
          Label walkLabel = l;
          walkLabel.arrivalTime += t.walkMin * 60;
          walkLabel.walkDist += (float)t.distance;
          walkLabel.routeId = "walk";
          walkLabel.boardStop = stopId;
          walkLabel.alightStop = t.to;
          walkLabel.prevLabel = std::make_shared<Label>(l);

          if (addLabel(bags[k][t.to], walkLabel)) {
            newMarked.insert(t.to);
          }
        }
      }
    }

    markedStops = newMarked;
    if (markedStops.empty())
      break;
  }

  // Collect results from destination
  std::vector<Label> allDestLabels;
  for (int k = 0; k <= MAX_ROUNDS; ++k) {
    if (bags[k].count(destination)) {
      for (const auto &l : bags[k][destination]) {
        allDestLabels.push_back(l);
      }
    }
  }

  return getParetoSet(allDestLabels);
}

bool McRAPTOR::addLabel(std::vector<Label> &bag, const Label &newLabel) {
  for (auto it = bag.begin(); it != bag.end();) {
    if (it->dominates(newLabel))
      return false;
    if (newLabel.dominates(*it)) {
      it = bag.erase(it);
    } else {
      ++it;
    }
  }
  bag.push_back(newLabel);
  return true;
}

std::vector<Label> McRAPTOR::getParetoSet(const std::vector<Label> &labels) {
  std::vector<Label> pareto;
  for (const auto &l : labels) {
    bool dominated = false;
    for (auto it = pareto.begin(); it != pareto.end();) {
      if (it->dominates(l)) {
        dominated = true;
        break;
      }
      if (l.dominates(*it)) {
        it = pareto.erase(it);
      } else {
        ++it;
      }
    }
    if (!dominated) {
      pareto.push_back(l);
    }
  }
  return pareto;
}

} // namespace biyahe
