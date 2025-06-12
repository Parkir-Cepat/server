// filepath: e:\Latihan-Coding\Hacktiv8\phase3\FINAL PROJECT\server\__tests__\utils\graphqlQueries.js

// Booking Queries and Mutations
export const CREATE_BOOKING = `
  mutation CreateBooking($input: BookingInput!) {
    createBooking(input: $input) {
      _id
      start_time
      end_time
      status
      qr_code
      total_price
    }
  }
`;

export const CANCEL_BOOKING = `
  mutation CancelBooking($id: ID!) {
    cancelBooking(id: $id) {
      _id
      status
      cancellation_reason
    }
  }
`;

export const GET_USER_BOOKINGS = `
  query GetUserBookings {
    getUserBookings {
      _id
      start_time
      end_time
      status
      total_price
      parking {
        name
        address
      }
    }
  }
`;

export const CHECK_IN_BOOKING = `
  mutation CheckIn($id: ID!, $qrCode: String!) {
    checkInBooking(id: $id, qr_code: $qrCode) {
      _id
      status
      check_in_time
    }
  }
`;

export const CHECK_OUT_BOOKING = `
  mutation CheckOut($id: ID!) {
    checkOutBooking(id: $id) {
      _id
      status
      check_out_time
    }
  }
`;

// Parking Queries and Mutations
export const SEARCH_PARKING = `
  query SearchParking($input: ParkingSearchInput!) {
    searchParkingSpaces(input: $input) {
      _id
      name
      address
      price_per_hour
      available
      distance
    }
  }
`;

export const ADD_PARKING = `
  mutation AddParking($input: ParkingInput!) {
    addParkingSpace(input: $input) {
      _id
      name
      address
      price_per_hour
      available
    }
  }
`;

export const UPDATE_PARKING = `
  mutation UpdateParking($id: ID!, $input: ParkingUpdateInput!) {
    updateParkingSpace(id: $id, input: $input) {
      _id
      name
      address
      price_per_hour
      available
    }
  }
`;

export const GET_PARKING_DETAILS = `
  query GetParkingDetails($id: ID!) {
    getParkingSpace(id: $id) {
      _id
      name
      address
      price_per_hour
      available
      slots
      booked_slots
      description
      images
      location {
        type
        coordinates
      }
    }
  }
`;
