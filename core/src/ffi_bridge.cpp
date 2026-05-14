#include "../include/mcraptor.hpp"
#include "../include/transit_graph.hpp"
#include <cstring>
#include <string>
#include <sstream>

#ifdef _WIN32
#define FFI_EXPORT __declspec(dllexport)
#else
#define FFI_EXPORT __attribute__((visibility("default")))
#endif

extern "C" {

FFI_EXPORT biyahe::McRAPTOR* create_engine() {
    return new biyahe::McRAPTOR();
}

FFI_EXPORT void destroy_engine(biyahe::McRAPTOR* engine) {
    delete engine;
}

FFI_EXPORT void query_route(biyahe::McRAPTOR* engine, const char* origin, const char* destination, int departureTime, char* result_buffer, int buffer_size) {
    if (!engine) return;

    auto results = engine->query(origin, destination, departureTime);
    
    std::stringstream ss;
    ss << "[";
    for (size_t i = 0; i < results.size(); ++i) {
        const auto& label = results[i];
        ss << "{"
           << "\"arrival\":" << label.arrivalTime << ","
           << "\"cost\":" << label.cost << ","
           << "\"transfers\":" << label.transfers << ","
           << "\"walk\":" << label.walkDist
           << "}";
        if (i < results.size() - 1) ss << ",";
    }
    ss << "]";

    std::string result_str = ss.str();
    std::strncpy(result_buffer, result_str.c_str(), buffer_size);
    result_buffer[buffer_size - 1] = '\0';
}

FFI_EXPORT void get_stations(char* result_buffer, int buffer_size) {
    biyahe::TransitGraph graph;
    auto ids = graph.getAllStationIds();
    
    std::stringstream ss;
    ss << "[";
    for (size_t i = 0; i < ids.size(); ++i) {
        const auto* s = graph.getStation(ids[i]);
        ss << "{"
           << "\"id\":\"" << s->id << "\","
           << "\"name\":\"" << s->name << "\","
           << "\"lat\":" << s->lat << ","
           << "\"lon\":" << s->lon
           << "}";
        if (i < ids.size() - 1) ss << ",";
    }
    ss << "]";

    std::string result_str = ss.str();
    std::strncpy(result_buffer, result_str.c_str(), buffer_size);
    result_buffer[buffer_size - 1] = '\0';
}

}
