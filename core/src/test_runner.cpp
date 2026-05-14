#include "../include/mcraptor.hpp"
#include <iostream>
#include <vector>

extern "C" {
    void query_route(biyahe::McRAPTOR* engine, const char* origin, const char* destination, int departureTime, char* result_buffer, int buffer_size);
    void get_stations(char* result_buffer, int buffer_size);
}

int main() {
    biyahe::McRAPTOR* engine = new biyahe::McRAPTOR();
    char buffer[4096];

    std::cout << "Testing get_stations..." << std::endl;
    get_stations(buffer, sizeof(buffer));
    std::cout << "Stations: " << buffer << std::endl << std::endl;

    std::cout << "Testing query_route (lrt1-baclaran to lrt2-antipolo)..." << std::endl;
    query_route(engine, "lrt1-baclaran", "lrt2-antipolo", 28800, buffer, sizeof(buffer)); // 8:00 AM
    std::cout << "Route Result: " << buffer << std::endl;

    delete engine;
    return 0;
}
