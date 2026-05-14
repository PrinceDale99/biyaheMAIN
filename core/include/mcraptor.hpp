#ifndef MCRAPTOR_HPP
#define MCRAPTOR_HPP

#include "transit_graph.hpp"
#include <vector>
#include <string>
#include <map>
#include <memory>
#include <set>

namespace biyahe {

struct Label {
    int arrivalTime; // seconds from midnight
    float cost;
    int transfers;
    float walkDist;
    std::string routeId;
    std::string boardStop;
    std::string alightStop;
    std::shared_ptr<Label> prevLabel;

    bool dominates(const Label& other) const {
        return arrivalTime <= other.arrivalTime &&
               cost <= other.cost &&
               transfers <= other.transfers &&
               walkDist <= other.walkDist &&
               (arrivalTime < other.arrivalTime ||
                cost < other.cost ||
                transfers < other.transfers ||
                walkDist < other.walkDist);
    }
};

class McRAPTOR {
public:
    McRAPTOR();
    std::vector<Label> query(const std::string& origin, const std::string& destination, int departureTimeSec);

private:
    TransitGraph graph;
    static const int MAX_ROUNDS = 5;

    bool addLabel(std::vector<Label>& bag, const Label& newLabel);
    std::vector<Label> getParetoSet(const std::vector<Label>& labels);
};

} // namespace biyahe

#endif // MCRAPTOR_HPP
