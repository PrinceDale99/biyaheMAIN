cmake_minimum_required(VERSION 3.10)
project(biyahe_core)

set(CMAKE_CXX_STANDARD 17)

# Output directory for the shared library
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# Include directories
include_directories(include)

# Source files
set(SOURCES
    src/algorithms/mcraptor.cpp
    src/algorithms/transit_graph.cpp
    src/algorithms/ultra.cpp
    src/fare/fare_matrix.cpp
    src/consensus/consensus.cpp
    src/ffi_bridge.cpp
)

# Create shared library
add_library(biyahe_core SHARED ${SOURCES})

# Target properties
set_target_properties(biyahe_core PROPERTIES
    PREFIX ""
    SUFFIX ".so"
)

if(WIN32)
    set_target_properties(biyahe_core PROPERTIES SUFFIX ".dll")
endif()
