(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
  Convert locations to and from short codes.

  Open Location Codes are short, 10-11 character codes that can be used instead
  of street addresses. The codes can be generated and decoded offline, and use
  a reduced character set that minimises the chance of codes including words.

  Codes are able to be shortened relative to a nearby location. This means that
  in many cases, only four to seven characters of the code are needed.
  To recover the original code, the same location is not required, as long as
  a nearby location is provided.

  Codes represent rectangular areas rather than points, and the longer the
  code, the smaller the area. A 10 character code represents a 13.5x13.5
  meter area (at the equator. An 11 character code represents approximately
  a 2.8x3.5 meter area.

  Two encoding algorithms are used. The first 10 characters are pairs of
  characters, one for latitude and one for latitude, using base 20. Each pair
  reduces the area of the code by a factor of 400. Only even code lengths are
  sensible, since an odd-numbered length would have sides in a ratio of 20:1.

  At position 11, the algorithm changes so that each character selects one
  position from a 4x5 grid. This allows single-character refinements.

  Examples:
  
  var OpenLocationCode = require('open-location-code').OpenLocationCode;
	var openLocationCode = new OpenLocationCode();
  
  // Encode a location, default accuracy:
	var code = openLocationCode.encode(47.365590, 8.524997);
	console.log(code);
  
  // Encode a location using one stage of additional refinement:
  code = openLocationCode.encode(47.365590, 8.524997, 11);
  console.log(code);
  
  //Decode a full code:
	var coord = openLocationCode.decode(code);
  var msg = 'Center is ' + coord.latitudeCenter + ',' + coord.longitudeCenter;
	console.log(msg);
   
  // Attempt to trim the first characters from a code:
	var shortCode = openLocationCode.shorten('8FVC9G8F+6X', 47.5, 8.5);
	console.log(shortCode);

  // Recover the full code from a short code:
  var nearestCode = openLocationCode.recoverNearest('9G8F+6X', 47.4, 8.6);
	console.log(nearestCode);
  nearestCode = openLocationCode.recoverNearest('8F+6X', 47.4, 8.6);
  console.log(nearestCode);
    
 */

 
var OpenLocationCode = function () {};

  // A separator used to break the code into two parts to aid memorability.
  var SEPARATOR_ = '+';

  // The number of characters to place before the separator.
  var SEPARATOR_POSITION_ = 8;

  // The character used to pad codes.
  var PADDING_CHARACTER_ = '0';

  // The character set used to encode the values.
  var CODE_ALPHABET_ = '23456789CFGHJMPQRVWX';

  // The base to use to convert numbers to/from.
  var ENCODING_BASE_ = CODE_ALPHABET_.length;

  // The maximum value for latitude in degrees.
  var LATITUDE_MAX_ = 90;

  // The maximum value for longitude in degrees.
  var LONGITUDE_MAX_ = 180;

  // Maxiumum code length using lat/lng pair encoding. The area of such a
  // code is approximately 13x13 meters (at the equator), and should be suitable
  // for identifying buildings. This excludes prefix and separator characters.
  var PAIR_CODE_LENGTH_ = 10;

  // The resolution values in degrees for each position in the lat/lng pair
  // encoding. These give the place value of each position, and therefore the
  // dimensions of the resulting area.
  var PAIR_RESOLUTIONS_ = [20.0, 1.0, .05, .0025, .000125];

  // Number of columns in the grid refinement method.
  var GRID_COLUMNS_ = 4;

  // Number of rows in the grid refinement method.
  var GRID_ROWS_ = 5;

  // Size of the initial grid in degrees.
  var GRID_SIZE_DEGREES_ = 0.000125;

  // Minimum length of a code that can be shortened.
  var MIN_TRIMMABLE_CODE_LEN_ = 6;

  /**
    Determines if a code is valid.

    To be valid, all characters must be from the Open Location Code character
    set with at most one separator. The separator can be in any even-numbered
    position up to the eighth digit.
   */
  OpenLocationCode.prototype.isValid = function(code) {
    if (!code) {
      return false;
    }
    // The separator is required.
    if (code.indexOf(SEPARATOR_) == -1) {
      return false;
    }
    if (code.indexOf(SEPARATOR_) != code.lastIndexOf(SEPARATOR_)) {
      return false;
    }
    // Is it the only character?
    if (code.length == 1) {
      return false;
    }
    // Is it in an illegal position?
    if (code.indexOf(SEPARATOR_) > SEPARATOR_POSITION_ ||
        code.indexOf(SEPARATOR_) % 2 == 1) {
      return false;
    }
    // We can have an even number of padding characters before the separator,
    // but then it must be the final character.
    if (code.indexOf(PADDING_CHARACTER_) > -1) {
      // Not allowed to start with them!
      if (code.indexOf(PADDING_CHARACTER_) == 0) {
        return false;
      }
      // There can only be one group and it must have even length.
      var padMatch = code.match(new RegExp('(' + PADDING_CHARACTER_ + '+)', 'g'));
      if (padMatch.length > 1 || padMatch[0].length % 2 == 1 ||
          padMatch[0].length > SEPARATOR_POSITION_ - 2) {
        return false;
      }
      // If the code is long enough to end with a separator, make sure it does.
      if (code.charAt(code.length - 1) != SEPARATOR_) {
        return false;
      }
    }
    // If there are characters after the separator, make sure there isn't just
    // one of them (not legal).
    if (code.length - code.indexOf(SEPARATOR_) - 1 == 1) {
      return false;
    }

    // Strip the separator and any padding characters.
    code = code.replace(new RegExp('\\' + SEPARATOR_ + '+'), '')
        .replace(new RegExp(PADDING_CHARACTER_ + '+'), '');
    // Check the code contains only valid characters.
    for (var i = 0, len = code.length; i < len; i++) {
      var character = code.charAt(i).toUpperCase();
      if (character != SEPARATOR_ && CODE_ALPHABET_.indexOf(character) == -1) {
        return false;
      }
    }
    return true;
  };

  /**
    Determines if a code is a valid short code.

    A short Open Location Code is a sequence created by removing four or more
    digits from an Open Location Code. It must include a separator
    character.
   */
  OpenLocationCode.prototype.isShort = function(code) {
    // Check it's valid.
    if (!this.isValid(code)) {
      return false;
    }
    // If there are less characters than expected before the SEPARATOR.
    if (code.indexOf(SEPARATOR_) >= 0 &&
        code.indexOf(SEPARATOR_) < SEPARATOR_POSITION_) {
      return true;
    }
    return false;
  };

  /**
    Determines if a code is a valid full Open Location Code.

    Not all possible combinations of Open Location Code characters decode to
    valid latitude and longitude values. This checks that a code is valid
    and also that the latitude and longitude values are legal. If the prefix
    character is present, it must be the first character. If the separator
    character is present, it must be after four characters.
   */
  OpenLocationCode.prototype.isFull = function(code) {
    if (!this.isValid(code)) {
      return false;
    }
    // If it's short, it's not full.
    if (this.isShort(code)) {
      return false;
    }

    // Work out what the first latitude character indicates for latitude.
    var firstLatValue = CODE_ALPHABET_.indexOf(
        code.charAt(0).toUpperCase()) * ENCODING_BASE_;
    if (firstLatValue >= LATITUDE_MAX_ * 2) {
      // The code would decode to a latitude of >= 90 degrees.
      return false;
    }
    if (code.length > 1) {
      // Work out what the first longitude character indicates for longitude.
      var firstLngValue = CODE_ALPHABET_.indexOf(
          code.charAt(1).toUpperCase()) * ENCODING_BASE_;
      if (firstLngValue >= LONGITUDE_MAX_ * 2) {
        // The code would decode to a longitude of >= 180 degrees.
        return false;
      }
    }
    return true;
  };

  /**
    Encode a location into an Open Location Code.

    Produces a code of the specified length, or the default length if no length
    is provided.

    The length determines the accuracy of the code. The default length is
    10 characters, returning a code of approximately 13.5x13.5 meters. Longer
    codes represent smaller areas, but lengths > 14 are sub-centimetre and so
    11 or 12 are probably the limit of useful codes.

    Args:
      latitude: A latitude in signed decimal degrees. Will be clipped to the
          range -90 to 90.
      longitude: A longitude in signed decimal degrees. Will be normalised to
          the range -180 to 180.
      codeLength: The number of significant digits in the output code, not
          including any separator characters.
   */
  OpenLocationCode.prototype.encode = function(latitude,
      longitude, codeLength) {
    if (typeof codeLength == 'undefined') {
      codeLength = PAIR_CODE_LENGTH_;
    }
    if (codeLength < 2 ||
        (codeLength < SEPARATOR_POSITION_ && codeLength % 2 == 1)) {
      throw 'IllegalArgumentException: Invalid Open Location Code length';
    }
    // Ensure that latitude and longitude are valid.
    latitude = clipLatitude(latitude);
    longitude = normalizeLongitude(longitude);
    // Latitude 90 needs to be adjusted to be just less, so the returned code
    // can also be decoded.
    if (latitude == 90) {
      latitude = latitude - computeLatitudePrecision(codeLength);
    }
    var code = encodePairs(
        latitude, longitude, Math.min(codeLength, PAIR_CODE_LENGTH_));
    // If the requested length indicates we want grid refined codes.
    if (codeLength > PAIR_CODE_LENGTH_) {
      code += encodeGrid(
          latitude, longitude, codeLength - PAIR_CODE_LENGTH_);
    }
    return code;
  };

  /**
    Decodes an Open Location Code into the location coordinates.

    Returns a CodeArea object that includes the coordinates of the bounding
    box - the lower left, center and upper right.

    Args:
      code: The Open Location Code to decode.

    Returns:
      A CodeArea object that provides the latitude and longitude of two of the
      corners of the area, the center, and the length of the original code.
   */
  OpenLocationCode.prototype.decode = function(code) {
    if (!this.isFull(code)) {
      throw ('IllegalArgumentException: ' +
          'Passed Open Location Code is not a valid full code: ' + code);
    }
    // Strip out separator character (we've already established the code is
    // valid so the maximum is one), padding characters and convert to upper
    // case.
    code = code.replace(SEPARATOR_, '');
    code = code.replace(new RegExp(PADDING_CHARACTER_ + '+'), '');
    code = code.toUpperCase();
    // Decode the lat/lng pair component.
    var codeArea = decodePairs(code.substring(0, PAIR_CODE_LENGTH_));
    // If there is a grid refinement component, decode that.
    if (code.length <= PAIR_CODE_LENGTH_) {
      return codeArea;
    }
    var gridArea = decodeGrid(code.substring(PAIR_CODE_LENGTH_));
    return CodeArea(
      codeArea.latitudeLo + gridArea.latitudeLo,
      codeArea.longitudeLo + gridArea.longitudeLo,
      codeArea.latitudeLo + gridArea.latitudeHi,
      codeArea.longitudeLo + gridArea.longitudeHi,
      codeArea.codeLength + gridArea.codeLength);
  };

  /**
    Recover the nearest matching code to a specified location.

    Given a short Open Location Code of between four and seven characters,
    this recovers the nearest matching full code to the specified location.

    The number of characters that will be prepended to the short code, depends
    on the length of the short code and whether it starts with the separator.

    If it starts with the separator, four characters will be prepended. If it
    does not, the characters that will be prepended to the short code, where S
    is the supplied short code and R are the computed characters, are as
    follows:
    SSSS    -> RRRR.RRSSSS
    SSSSS   -> RRRR.RRSSSSS
    SSSSSS  -> RRRR.SSSSSS
    SSSSSSS -> RRRR.SSSSSSS
    Note that short codes with an odd number of characters will have their
    last character decoded using the grid refinement algorithm.

    Args:
      shortCode: A valid short OLC character sequence.
      referenceLatitude: The latitude (in signed decimal degrees) to use to
          find the nearest matching full code.
      referenceLongitude: The longitude (in signed decimal degrees) to use
          to find the nearest matching full code.

    Returns:
      The nearest full Open Location Code to the reference location that matches
      the short code. Note that the returned code may not have the same
      computed characters as the reference location. This is because it returns
      the nearest match, not necessarily the match within the same cell. If the
      passed code was not a valid short code, but was a valid full code, it is
      returned unchanged.
   */
  OpenLocationCode.prototype.recoverNearest = function(
      shortCode, referenceLatitude, referenceLongitude) {
    if (!this.isShort(shortCode)) {
      if (this.isFull(shortCode)) {
        return shortCode;
      } else {
        throw 'ValueError: Passed short code is not valid: ' + shortCode;
      }
    }
    // Ensure that latitude and longitude are valid.
    referenceLatitude = clipLatitude(referenceLatitude);
    referenceLongitude = normalizeLongitude(referenceLongitude);

    // Clean up the passed code.
    shortCode = shortCode.toUpperCase();
    // Compute the number of digits we need to recover.
    var paddingLength = SEPARATOR_POSITION_ - shortCode.indexOf(SEPARATOR_);
    // The resolution (height and width) of the padded area in degrees.
    var resolution = Math.pow(20, 2 - (paddingLength / 2));
    // Distance from the center to an edge (in degrees).
    var areaToEdge = resolution / 2.0;

    // Now round down the reference latitude and longitude to the resolution.
    var roundedLatitude = Math.floor(referenceLatitude / resolution) *
        resolution;
    var roundedLongitude = Math.floor(referenceLongitude / resolution) *
        resolution;

    // Use the reference location to pad the supplied short code and decode it.
    var codeArea = this.decode(
        this.encode(roundedLatitude, roundedLongitude).substr(0, paddingLength)
        + shortCode);
    // How many degrees latitude is the code from the reference? If it is more
    // than half the resolution, we need to move it east or west.
    var degreesDifference = codeArea.latitudeCenter - referenceLatitude;
    if (degreesDifference > areaToEdge) {
      // If the center of the short code is more than half a cell east,
      // then the best match will be one position west.
      codeArea.latitudeCenter -= resolution;
    } else if (degreesDifference < -areaToEdge) {
      // If the center of the short code is more than half a cell west,
      // then the best match will be one position east.
      codeArea.latitudeCenter += resolution;
    }

    // How many degrees longitude is the code from the reference?
    degreesDifference = codeArea.longitudeCenter - referenceLongitude;
    if (degreesDifference > areaToEdge) {
      codeArea.longitudeCenter -= resolution;
    } else if (degreesDifference < -areaToEdge) {
      codeArea.longitudeCenter += resolution;
    }

    return this.encode(
        codeArea.latitudeCenter, codeArea.longitudeCenter, codeArea.codeLength);
  };

  /**
    Remove characters from the start of an OLC code.

    This uses a reference location to determine how many initial characters
    can be removed from the OLC code. The number of characters that can be
    removed depends on the distance between the code center and the reference
    location.

    The minimum number of characters that will be removed is four. If more than
    four characters can be removed, the additional characters will be replaced
    with the padding character. At most eight characters will be removed.

    The reference location must be within 50% of the maximum range. This ensures
    that the shortened code will be able to be recovered using slightly different
    locations.

    Args:
      code: A full, valid code to shorten.
      latitude: A latitude, in signed decimal degrees, to use as the reference
          point.
      longitude: A longitude, in signed decimal degrees, to use as the reference
          point.

    Returns:
      Either the original code, if the reference location was not close enough,
      or the .
   */
  OpenLocationCode.prototype.shorten = function(
      code, latitude, longitude) {
    if (!this.isFull(code)) {
      throw 'ValueError: Passed code is not valid and full: ' + code;
    }
    if (code.indexOf(PADDING_CHARACTER_) != -1) {
      throw 'ValueError: Cannot shorten padded codes: ' + code;
    }
    var code = code.toUpperCase();
    var codeArea = this.decode(code);
    if (codeArea.codeLength < MIN_TRIMMABLE_CODE_LEN_) {
      throw 'ValueError: Code length must be at least ' +
          MIN_TRIMMABLE_CODE_LEN_;
    }
    // Ensure that latitude and longitude are valid.
    latitude = clipLatitude(latitude);
    longitude = normalizeLongitude(longitude);
    // How close are the latitude and longitude to the code center.
    var range = Math.max(
        Math.abs(codeArea.latitudeCenter - latitude),
        Math.abs(codeArea.longitudeCenter - longitude));
    for (var i = PAIR_RESOLUTIONS_.length - 2; i >= 1; i--) {
      // Check if we're close enough to shorten. The range must be less than 1/2
      // the resolution to shorten at all, and we want to allow some safety, so
      // use 0.3 instead of 0.5 as a multiplier.
      if (range < (PAIR_RESOLUTIONS_[i] * 0.3)) {
        // Trim it.
        return code.substring((i + 1) * 2);
      }
    }
    return code;
  };

  /**
    Clip a latitude into the range -90 to 90.

    Args:
      latitude: A latitude in signed decimal degrees.
   */
  var clipLatitude = function(latitude) {
    return Math.min(90, Math.max(-90, latitude));
  };

  /**
    Compute the latitude precision value for a given code length. Lengths <=
    10 have the same precision for latitude and longitude, but lengths > 10
    have different precisions due to the grid method having fewer columns than
    rows.
   */
  var computeLatitudePrecision = function(codeLength) {
    if (codeLength <= 10) {
      return Math.pow(20, Math.floor(codeLength / -2 + 2));
    }
    return Math.pow(20, -3) / Math.pow(GRID_ROWS_, codeLength - 10);
  };

  /**
    Normalize a longitude into the range -180 to 180, not including 180.

    Args:
      longitude: A longitude in signed decimal degrees.
   */
  var normalizeLongitude = function(longitude) {
    while (longitude < -180) {
      longitude = longitude + 360;
    }
    while (longitude >= 180) {
      longitude = longitude - 360;
    }
    return longitude;
  };

  /**
    Encode a location into a sequence of OLC lat/lng pairs.

    This uses pairs of characters (longitude and latitude in that order) to
    represent each step in a 20x20 grid. Each code, therefore, has 1/400th
    the area of the previous code.

    Args:
      latitude: A latitude in signed decimal degrees.
      longitude: A longitude in signed decimal degrees.
      codeLength: The number of significant digits in the output code, not
          including any separator characters.
   */
  var encodePairs = function(latitude, longitude, codeLength) {
    var code = '';
    // Adjust latitude and longitude so they fall into positive ranges.
    var adjustedLatitude = latitude + LATITUDE_MAX_;
    var adjustedLongitude = longitude + LONGITUDE_MAX_;
    // Count digits - can't use string length because it may include a separator
    // character.
    var digitCount = 0;
    while (digitCount < codeLength) {
      // Provides the value of digits in this place in decimal degrees.
      var placeValue = PAIR_RESOLUTIONS_[Math.floor(digitCount / 2)];
      // Do the latitude - gets the digit for this place and subtracts that for
      // the next digit.
      var digitValue = Math.floor(adjustedLatitude / placeValue);
      adjustedLatitude -= digitValue * placeValue;
      code += CODE_ALPHABET_.charAt(digitValue);
      digitCount += 1;
      // And do the longitude - gets the digit for this place and subtracts that
      // for the next digit.
      digitValue = Math.floor(adjustedLongitude / placeValue);
      adjustedLongitude -= digitValue * placeValue;
      code += CODE_ALPHABET_.charAt(digitValue);
      digitCount += 1;
      // Should we add a separator here?
      if (digitCount == SEPARATOR_POSITION_ && digitCount < codeLength) {
        code += SEPARATOR_;
      }
    }
    if (code.length < SEPARATOR_POSITION_) {
      code = code + Array(SEPARATOR_POSITION_ - code.length + 1).join(PADDING_CHARACTER_);
    }
    if (code.length == SEPARATOR_POSITION_) {
      code = code + SEPARATOR_;
    }
    return code;
  };

  /**
    Encode a location using the grid refinement method into an OLC string.

    The grid refinement method divides the area into a grid of 4x5, and uses a
    single character to refine the area. This allows default accuracy OLC codes
    to be refined with just a single character.

    Args:
      latitude: A latitude in signed decimal degrees.
      longitude: A longitude in signed decimal degrees.
      codeLength: The number of characters required.
   */
  var encodeGrid = function(latitude, longitude, codeLength) {
    var code = '';
    var latPlaceValue = GRID_SIZE_DEGREES_;
    var lngPlaceValue = GRID_SIZE_DEGREES_;
    // Adjust latitude and longitude so they fall into positive ranges and
    // get the offset for the required places.
    var adjustedLatitude = (latitude + LATITUDE_MAX_) % latPlaceValue;
    var adjustedLongitude = (longitude + LONGITUDE_MAX_) % lngPlaceValue;
    for (var i = 0; i < codeLength; i++) {
      // Work out the row and column.
      var row = Math.floor(adjustedLatitude / (latPlaceValue / GRID_ROWS_));
      var col = Math.floor(adjustedLongitude / (lngPlaceValue / GRID_COLUMNS_));
      latPlaceValue /= GRID_ROWS_;
      lngPlaceValue /= GRID_COLUMNS_;
      adjustedLatitude -= row * latPlaceValue;
      adjustedLongitude -= col * lngPlaceValue;
      code += CODE_ALPHABET_.charAt(row * GRID_COLUMNS_ + col);
    }
    return code;
  };

  /**
    Decode an OLC code made up of lat/lng pairs.

    This decodes an OLC code made up of alternating latitude and longitude
    characters, encoded using base 20.

    Args:
      code: A valid OLC code, presumed to be full, but with the separator
      removed.
   */
  var decodePairs = function(code) {
    // Get the latitude and longitude values. These will need correcting from
    // positive ranges.
    var latitude = decodePairsSequence(code, 0);
    var longitude = decodePairsSequence(code, 1);
    // Correct the values and set them into the CodeArea object.
    return new CodeArea(
        latitude[0] - LATITUDE_MAX_,
        longitude[0] - LONGITUDE_MAX_,
        latitude[1] - LATITUDE_MAX_,
        longitude[1] - LONGITUDE_MAX_,
        code.length);
  };

  /**
    Decode either a latitude or longitude sequence.

    This decodes the latitude or longitude sequence of a lat/lng pair encoding.
    Starting at the character at position offset, every second character is
    decoded and the value returned.

    Args:
      code: A valid OLC code, presumed to be full, with the separator removed.
      offset: The character to start from.

    Returns:
      A pair of the low and high values. The low value comes from decoding the
      characters. The high value is the low value plus the resolution of the
      last position. Both values are offset into positive ranges and will need
      to be corrected before use.
   */
  var decodePairsSequence = function(code, offset) {
    var i = 0;
    var value = 0;
    while (i * 2 + offset < code.length) {
      value += CODE_ALPHABET_.indexOf(code.charAt(i * 2 + offset)) *
          PAIR_RESOLUTIONS_[i];
      i += 1;
    }
    return [value, value + PAIR_RESOLUTIONS_[i - 1]];
  };

  /**
    Decode the grid refinement portion of an OLC code.

    This decodes an OLC code using the grid refinement method.

    Args:
      code: A valid OLC code sequence that is only the grid refinement
          portion. This is the portion of a code starting at position 11.
   */
  var decodeGrid = function(code) {
    var latitudeLo = 0.0;
    var longitudeLo = 0.0;
    var latPlaceValue = GRID_SIZE_DEGREES_;
    var lngPlaceValue = GRID_SIZE_DEGREES_;
    var i = 0;
    while (i < code.length) {
      var codeIndex = CODE_ALPHABET_.indexOf(code.charAt(i));
      var row = Math.floor(codeIndex / GRID_COLUMNS_);
      var col = codeIndex % GRID_COLUMNS_;

      latPlaceValue /= GRID_ROWS_;
      lngPlaceValue /= GRID_COLUMNS_;

      latitudeLo += row * latPlaceValue;
      longitudeLo += col * lngPlaceValue;
      i += 1;
    }
    return CodeArea(
        latitudeLo, longitudeLo, latitudeLo + latPlaceValue,
        longitudeLo + lngPlaceValue, code.length);
  };
  
    /**
    Coordinates of a decoded Open Location Code.

    The coordinates include the latitude and longitude of the lower left and
    upper right corners and the center of the bounding box for the area the
    code represents.

    Attributes:
      latitude_lo: The latitude of the SW corner in degrees.
      longitude_lo: The longitude of the SW corner in degrees.
      latitude_hi: The latitude of the NE corner in degrees.
      longitude_hi: The longitude of the NE corner in degrees.
      latitude_center: The latitude of the center in degrees.
      longitude_center: The longitude of the center in degrees.
      code_length: The number of significant characters that were in the code.
          This excludes the separator.
   */
  var CodeArea = OpenLocationCode.prototype.CodeArea = function(
    latitudeLo, longitudeLo, latitudeHi, longitudeHi, codeLength) {
    return new CodeAreaFn.init(
        latitudeLo, longitudeLo, latitudeHi, longitudeHi, codeLength);
  };
  
  var CodeAreaFn = {
    init: function(
        latitudeLo, longitudeLo, latitudeHi, longitudeHi, codeLength) {
      this.latitudeLo = latitudeLo;
      this.longitudeLo = longitudeLo;
      this.latitudeHi = latitudeHi;
      this.longitudeHi = longitudeHi;
      this.codeLength = codeLength;
      this.latitudeCenter = Math.min(
          latitudeLo + (latitudeHi - latitudeLo) / 2, LATITUDE_MAX_);
      this.longitudeCenter = Math.min(
          longitudeLo + (longitudeHi - longitudeLo) / 2, LONGITUDE_MAX_);
    }
  };


exports.OpenLocationCode = OpenLocationCode;
},{}],2:[function(require,module,exports){
(function (global){(function (){
//browserify requests.js -o bundle.js 
var OpenLocationCode = require('open-location-code').OpenLocationCode
var intersections = require('../test/intersections.js')

function client_request(url, data, operation) {
    console.log("data on client request", data)
    $.ajax({
        type: 'POST',
        url: url,
        contentType: 'application/json',
        data: data,
        success: function (data) {
            console.log("success", data)
            
            output_data(operation, data)

        },
        error: function (err) {
            console.log("errore", err)
        }
    });

}
//Single test

global.choose_operation = function (operation) {
    var url;
    var data;

    switch (operation) {

        //Random point
        case "insert":
            url = '/insert'
            
            break;
        case "pin_search":

            url = '/pin_search'
            data = JSON.stringify({ 'keyword': '8FXX4275+WC', "threshold": -1 })

            break;
        case "superset_search":

            url = '/superset_search'
            data = JSON.stringify({ 'keyword': '8FXX4275+WC', "threshold": 5 })
            break;

        case "remove":

            url = '/remove'
            data = JSON.stringify({ 'keyword': '8FQJ3600+', "obj": "9MTZIQWB9Q9IONIEDDRY9MLMWWKCK9EVVSRZOKWAUETQYYJDRABPU9DSIV9LBSDBBXBADXGHJWTFSFVWQ" })
            break;

    }
    client_request(url, data, operation)

}


global.output_data = function (operation, data) {
    console.log(data)

    switch (operation) {

        case "pin_search":
        case "superset_search":

            var messages = []
            for (i = 0; i < data.length; i++) {
                for (j = 0; j < data[i].length; j++) {
                    console.log(data[i][j])
                    messages.push(data[i][j])
                }
            }

            for (element of messages) {
                //console.log(element)

                coord = decodeOLC(element.message)
                L.marker([coord.latitudeCenter, coord.longitudeCenter]).addTo(layerGroup);
                //marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();
            }

            break;

        case "clear":
            // remove all the markers in one go
            layerGroup.clearLayers();
            break;
        default:
            break;

    }
}


function decodeOLC(code) {

    const openLocationCode = new OpenLocationCode();
    const coord = openLocationCode.decode(code)
    return coord

}

//Insert transactions in DHT 
global.insert_intersections = function (operation) {
    console.log("Insert intersections")

    url = '/insertIota'
    intersections.intersections.forEach(element => {
        data = JSON.stringify({ 'lat': element.lat, "lng": element.lng })
        client_request(url, data, operation)
    });
}



}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../test/intersections.js":3,"open-location-code":1}],3:[function(require,module,exports){
var paths = require('./path');
mypath_label = ["path1", "path2", "path3", "path4", "path5", "path6"]
mypath = [paths.path1, paths.path2, paths.path3, paths.path4, paths.path5, paths.path6]

//takes common points between the paths
intersections = []
for (let i = 0; i < mypath.length; i++) {
    for (let k = i + 1; k < mypath.length; k++) {

        if (mypath[i].filter(item1 => mypath[k].some(item2 => item1.lat === item2.lat && item1.lng === item2.lng)) != "") {
            //console.log("Punti in comune:", mypath_label[i], mypath_label[k], mypath[i].filter(item1 => mypath[k].some(item2 => item1.lat === item2.lat && item1.lng === item2.lng)))

            intersections.push(mypath[i].filter(item1 => mypath[k].some(item2 => item1.lat === item2.lat && item1.lng === item2.lng)))
        }
    }
}

intersections = intersections.flat(1); 

//delete duplicates
intersections = intersections.filter((thing, index, self) =>
    index === self.findIndex((t) => (
        t.lat === thing.lat && t.lng === thing.lng
    ))
)

console.log("Intersezioni:", intersections)

module.exports = {intersections}
},{"./path":4}],4:[function(require,module,exports){

//PIN
/*
path1 = [

    {
        "lat": 55.21,
        "lng": 91.45138
    },
    {
        "lat": 55.21039,
        "lng": 91.4522
    },
    {
        "lat": 55.21253,
        "lng": 91.45636
    },

    {
        "lat": 51.13021,
        "lng": 10.34904
    },
    {
        "lat": 51.13045,
        "lng": 10.34902
    },

    {
        "lat": 51.13064,
        "lng": 10.349
    },

    {
        "lat": 51.128,
        "lng": 10.34872
    },
    {
        "lat": 51.12784,
        "lng": 10.34903
    },

    {
        "lat": 38.11194,
        "lng": 13.36111
    },
    {
        "lat": 38.11186,
        "lng": 13.36102
    },
    {
        "lat": 38.11175,
        "lng": 13.36087
    },
    {
        "lat": 38.11175,
        "lng": 13.36087
    },

    {
        "lat": 38.11176,
        "lng": 13.35843
    },

    {
        "lat": 51.12945,
        "lng": 10.35095
    },
    {
        "lat": 51.12943,
        "lng": 10.35058
    },
    {
        "lat": 51.12951,
        "lng": 10.3502
    },


    {
        "lat": -13.16414,
        "lng": -72.53996
    },
    {
        "lat": -13.16409,
        "lng": -72.54007
    },
    {
        "lat": 51.12945,
        "lng": 10.35095
    },
    {
        "lat": 51.12943,
        "lng": 10.35058
    },


        {
            "lat": 32.15087,
            "lng": -1.47333
        },

        {
            "lat": 32.14786,
            "lng": -1.47217
        },

        {
            "lat": 51.12954,
            "lng": 10.35181
        },
        {
            "lat": 51.12947,
            "lng": 10.35126
        },

        {
            "lat": 51.12502,
            "lng": 10.35352
        },
        {
            "lat": 51.12505,
            "lng": 10.35362
        },
        {
            "lat": 51.12506,
            "lng": 10.35371
        },
        {
            "lat": 51.12503,
            "lng": 10.35381
        },
        {
            "lat": 51.12498,
            "lng": 10.35385
        },
        {
            "lat": 51.12492,
            "lng": 10.35389
        },
        {
            "lat": 51.12483,
            "lng": 10.35388
        },
        {
            "lat": 51.12464,
            "lng": 10.35386
        },
        {
            "lat": 51.12443,
            "lng": 10.35373
        },
        {
            "lat": 51.12435,
            "lng": 10.35368
        },
        {
            "lat": 51.12428,
            "lng": 10.35357
        },
        {
            "lat": 51.12421,
            "lng": 10.35338
        },
        {
            "lat": 51.12415,
            "lng": 10.35307
        },

        //bolo

        {
            "lat": 44.4378,
            "lng": 11.22261
        },

        {
            "lat": 44.43786,
            "lng": 11.22246
        },
        {
            "lat": 51.61037,
            "lng": -0.34227
        },


        {
            "lat": 55.1863,
            "lng": 91.32109
        },
        {
            "lat": 55.18678,
            "lng": 91.32156
        },
        {
            "lat": 38.11175,
            "lng": 13.36087
        },
        {
            "lat": 38.11175,
            "lng": 13.36087
        },
        {
            "lat": 38.11186,
            "lng": 13.36072
        },
        {
            "lat": 38.11216,
            "lng": 13.3603
        },
        {
            "lat": 38.11225,
            "lng": 13.36018
        },
        {
            "lat": 38.11227,
            "lng": 13.36017
        },
        {
            "lat": 38.1123,
            "lng": 13.36014
        },

        {
            "lat": 38.11684,
            "lng": 13.34773
        },
        {
            "lat": 38.1162,
            "lng": 13.34794
        },
        {
            "lat": 38.1162,
            "lng": 13.34794
        },
        {
            "lat": 38.11635,
            "lng": 13.34861
        },
        {
            "lat": 38.11635,
            "lng": 13.34861
        },

        {
            "lat": 37.87203,
            "lng": 14.99702
        },

        {
            "lat": -12.42964,
            "lng": -72.64603
        },
        {
            "lat": -12.42969,
            "lng": -72.64576
        },

        {
            "lat": 44.29928,
            "lng": 12.17796
        },
        {
            "lat": 32.14786,
            "lng": -1.47217
        },
        {
            "lat": 32.14791,
            "lng": -1.47222
        },

        {
            "lat": 51.12483,
            "lng": 10.35388
        },
        {
            "lat": 51.12464,
            "lng": 10.35386
        },


        {
            "lat": 32.15087,
            "lng": -1.47333
        },

        {
            "lat": 32.14786,
            "lng": -1.47217
        },


        {
            "lat": 32.14859,
            "lng": -1.4725
        },

        {
            "lat": 38.11225,
            "lng": 13.36018
        },

        {
            "lat": 38.11237,
            "lng": 13.36008
        },
        {
            "lat": 38.11235,
            "lng": 13.36004
        },

        {
            "lat": 38.11164,
            "lng": 13.35809
        },

        //Russia
        {
            "lat": 55.18017,
            "lng": 91.31826
        },
        {
            "lat": 55.18021,
            "lng": 91.3198
        },

        {
            "lat": 55.18212,
            "lng": 91.31905
        },

        {
            "lat": 51.13048,
            "lng": 10.35772
        },
        {
            "lat": 51.13033,
            "lng": 10.35702
        },
        {
            "lat": 51.13022,
            "lng": 10.35652
        },

        {
            "lat": -11.6679,
            "lng": -74.31387
        },

        {
            "lat": 44.44728,
            "lng": 10.94594
        },
        {
            "lat": 44.30028,
            "lng": 12.17824
        },
        {
            "lat": 55.21,
            "lng": 91.45138
        },
        {
            "lat": 55.21039,
            "lng": 91.4522
        },
        {
            "lat": 55.21253,
            "lng": 91.45636
        },
    
        {
            "lat": 51.13021,
            "lng": 10.34904
        },
        {
            "lat": 51.13045,
            "lng": 10.34902
        },
    
        {
            "lat": 51.13064,
            "lng": 10.349
        },
    
        {
            "lat": 51.128,
            "lng": 10.34872
        },
        {
            "lat": 51.12784,
            "lng": 10.34903
        },
    
        {
            "lat": 38.11194,
            "lng": 13.36111
        },
        {
            "lat": 38.11186,
            "lng": 13.36102
        },
        {
            "lat": 38.11175,
            "lng": 13.36087
        },
        {
            "lat": 44.44718,
            "lng": 10.94586
        },

        {
            "lat": 37.87205,
            "lng": 14.99703
        },
   
        {
            "lat": 37.87205,
            "lng": 14.99703
        },
        {
            "lat": 37.87203,
            "lng": 14.99702
        },


        {
            "lat": 37.86827,
            "lng": 15.00246
        },
        {
            "lat": 37.86827,
            "lng": 15.00246
        },

        {
            "lat": 51.12821,
            "lng": 10.34842
        },
        {
            "lat": 51.128,
            "lng": 10.34872
        },
        {
            "lat": 51.12784,
            "lng": 10.34903
        },

        {
            "lat": 55.18017,
            "lng": 91.31826
        },

        {
            "lat": 55.20786,
            "lng": 91.36774
        },
        {
            "lat": 55.18372,
            "lng": 91.31882
        },
        {
            "lat": 55.18397,
            "lng": 91.31903
        },
        {
            "lat": 55.18455,
            "lng": 91.31955
        },
        {
            "lat": 55.1852,
            "lng": 91.32013
        },
        {
            "lat": 55.1863,
            "lng": 91.32109
        },
        {
            "lat": 55.18678,
            "lng": 91.32156
        },
        {
            "lat": 55.18732,
            "lng": 91.32211
        },
        {
            "lat": 55.18849,
            "lng": 91.32321
        },
        {
            "lat": 55.19012,
            "lng": 91.32468
        },

        {
            "lat": 55.20808,
            "lng": 91.36838
        },


        {
            "lat": 32.15087,
            "lng": -1.47333
        },
        {
            "lat": 32.15208,
            "lng": -1.47406
        },
        {
            "lat": 32.1539,
            "lng": -1.47523
        },

        {
            "lat": 55.18017,
            "lng": 91.31826
        },
        {
            "lat": 55.18849,
            "lng": 91.32321
        },
        {
            "lat": 55.19012,
            "lng": 91.32468
        },

        {
            "lat": 55.18455,
            "lng": 91.31955
        },
        {
            "lat": 51.51786,
            "lng": -0.15284
        },
        {
            "lat": 51.51787,
            "lng": -0.15288
        },


        {
            "lat": 51.13048,
            "lng": 10.35772
        },

        {
            "lat": 51.51787,
            "lng": -0.15288
        },

        {
            "lat": 51.1297,
            "lng": 10.35478
        },
        {
            "lat": 51.12959,
            "lng": 10.35428
        },

        {
            "lat": -10.65178,
            "lng": -75.38716
        },

        {
            "lat": 44.44746,
            "lng": 10.94609
        },
        {
            "lat": 44.44693,
            "lng": 10.94565
        },
        {
            "lat": 44.4378,
            "lng": 11.22261
        },

        {
            "lat": 44.43786,
            "lng": 11.22246
        },

        {
            "lat": 55.18017,
            "lng": 91.31826
        },

        {
            "lat": 55.18344,
            "lng": 91.31881
        },
        {
            "lat": 55.18358,
            "lng": 91.31877
        },
        {
            "lat": 55.18372,
            "lng": 91.31882
        },
        {
            "lat": 55.18397,
            "lng": 91.31903
        },
        {
            "lat": 55.18455,
            "lng": 91.31955
        },
        {
            "lat": 55.1852,
            "lng": 91.32013
        },
        {
            "lat": 55.1863,
            "lng": 91.32109
        },
        {
            "lat": 55.18678,
            "lng": 91.32156
        },
        {
            "lat": 55.18732,
            "lng": 91.32211
        },
        {
            "lat": 55.18849,
            "lng": 91.32321
        },
        {
            "lat": 55.19012,
            "lng": 91.32468
        },


    ]
    
*/
path2 = []
path3 = []
path4 = []
path5 = []
path6 = []


//SUPERSET

path1 = [

    {
        "lat": 55.21,
        "lng": 91.45138
    },
    {
        "lat": 55.21039,
        "lng": 91.4522
    },
    {
        "lat": 55.21253,
        "lng": 91.45636
    },

    {
        "lat": 51.13021,
        "lng": 10.34904
    },
    {
        "lat": 51.13045,
        "lng": 10.34902
    },

    {
        "lat": 51.13064,
        "lng": 10.349
    },



    {
        "lat": 51.128,
        "lng": 10.34872
    },
    {
        "lat": 51.12784,
        "lng": 10.34903
    },



    {
        "lat": 38.11194,
        "lng": 13.36111
    },
    {
        "lat": 38.11186,
        "lng": 13.36102
    },
    {
        "lat": 38.11175,
        "lng": 13.36087
    },
    {
        "lat": 38.11175,
        "lng": 13.36087
    },

    {
        "lat": 38.11176,
        "lng": 13.35843
    },

    {
        "lat": 51.12945,
        "lng": 10.35095
    },
    {
        "lat": 51.12943,
        "lng": 10.35058
    },
    {
        "lat": 51.12951,
        "lng": 10.3502
    },


    {
        "lat": -13.16414,
        "lng": -72.53996
    },
    {
        "lat": -13.16409,
        "lng": -72.54007
    },
    {
        "lat": 51.12945,
        "lng": 10.35095
    },
    {
        "lat": 51.12943,
        "lng": 10.35058
    },



],


    path2 = [


        {
            "lat": 32.15087,
            "lng": -1.47333
        },

        {
            "lat": 32.14786,
            "lng": -1.47217
        },

        {
            "lat": 51.12954,
            "lng": 10.35181
        },
        {
            "lat": 51.12947,
            "lng": 10.35126
        },

        {
            "lat": 51.12502,
            "lng": 10.35352
        },
        {
            "lat": 51.12505,
            "lng": 10.35362
        },
        {
            "lat": 51.12506,
            "lng": 10.35371
        },
        {
            "lat": 51.12503,
            "lng": 10.35381
        },
        {
            "lat": 51.12498,
            "lng": 10.35385
        },
        {
            "lat": 51.12492,
            "lng": 10.35389
        },
        {
            "lat": 51.12483,
            "lng": 10.35388
        },
        {
            "lat": 51.12464,
            "lng": 10.35386
        },
        {
            "lat": 51.12443,
            "lng": 10.35373
        },
        {
            "lat": 51.12435,
            "lng": 10.35368
        },
        {
            "lat": 51.12428,
            "lng": 10.35357
        },
        {
            "lat": 51.12421,
            "lng": 10.35338
        },
        {
            "lat": 51.12415,
            "lng": 10.35307
        },

        //bolo

        {
            "lat": 44.4378,
            "lng": 11.22261
        },

        {
            "lat": 44.43786,
            "lng": 11.22246
        },
        {
            "lat": 51.61037,
            "lng": -0.34227
        },

    ],


    path3 = [

        //Palermo


        {
            "lat": 55.1863,
            "lng": 91.32109
        },
        {
            "lat": 55.18678,
            "lng": 91.32156
        },
        {
            "lat": 38.11175,
            "lng": 13.36087
        },
        {
            "lat": 38.11175,
            "lng": 13.36087
        },
        {
            "lat": 38.11186,
            "lng": 13.36072
        },
        {
            "lat": 38.11216,
            "lng": 13.3603
        },
        {
            "lat": 38.11225,
            "lng": 13.36018
        },
        {
            "lat": 38.11227,
            "lng": 13.36017
        },
        {
            "lat": 38.1123,
            "lng": 13.36014
        },

        {
            "lat": 38.11684,
            "lng": 13.34773
        },
        {
            "lat": 38.1162,
            "lng": 13.34794
        },
        {
            "lat": 38.1162,
            "lng": 13.34794
        },
        {
            "lat": 38.11635,
            "lng": 13.34861
        },
        {
            "lat": 38.11635,
            "lng": 13.34861
        },

        {
            "lat": 37.87203,
            "lng": 14.99702
        },

        {
            "lat": -12.42964,
            "lng": -72.64603
        },
        {
            "lat": -12.42969,
            "lng": -72.64576
        },

        {
            "lat": 44.29928,
            "lng": 12.17796
        },
        {
            "lat": 32.14786,
            "lng": -1.47217
        },
        {
            "lat": 32.14791,
            "lng": -1.47222
        },

    ],
    path4 = [

        {
            "lat": 51.12483,
            "lng": 10.35388
        },
        {
            "lat": 51.12464,
            "lng": 10.35386
        },


        {
            "lat": 32.15087,
            "lng": -1.47333
        },

        {
            "lat": 32.14786,
            "lng": -1.47217
        },


        {
            "lat": 32.14859,
            "lng": -1.4725
        },

        {
            "lat": 38.11225,
            "lng": 13.36018
        },

        {
            "lat": 38.11237,
            "lng": 13.36008
        },
        {
            "lat": 38.11235,
            "lng": 13.36004
        },

        {
            "lat": 38.11164,
            "lng": 13.35809
        },

        //Russia
        {
            "lat": 55.18017,
            "lng": 91.31826
        },
        {
            "lat": 55.18021,
            "lng": 91.3198
        },

        {
            "lat": 55.18212,
            "lng": 91.31905
        },

        {
            "lat": 51.13048,
            "lng": 10.35772
        },
        {
            "lat": 51.13033,
            "lng": 10.35702
        },
        {
            "lat": 51.13022,
            "lng": 10.35652
        },

        {
            "lat": -11.6679,
            "lng": -74.31387
        },

        {
            "lat": 44.44728,
            "lng": 10.94594
        },
        {
            "lat": 44.30028,
            "lng": 12.17824
        },
        {
            "lat": 44.44718,
            "lng": 10.94586
        },

        {
            "lat": 37.87205,
            "lng": 14.99703
        },
    ],
    path5 = [



        {
            "lat": 37.87205,
            "lng": 14.99703
        },
        {
            "lat": 37.87203,
            "lng": 14.99702
        },


        {
            "lat": 37.86827,
            "lng": 15.00246
        },
        {
            "lat": 37.86827,
            "lng": 15.00246
        },

        {
            "lat": 51.12821,
            "lng": 10.34842
        },
        {
            "lat": 51.128,
            "lng": 10.34872
        },
        {
            "lat": 51.12784,
            "lng": 10.34903
        },

        {
            "lat": 55.18017,
            "lng": 91.31826
        },

        {
            "lat": 55.20786,
            "lng": 91.36774
        },
        {
            "lat": 55.20808,
            "lng": 91.36838
        },


        {
            "lat": 32.15087,
            "lng": -1.47333
        },
        {
            "lat": 32.15208,
            "lng": -1.47406
        },
        {
            "lat": 32.1539,
            "lng": -1.47523
        },

        {
            "lat": 55.18017,
            "lng": 91.31826
        },
        {
            "lat": 55.18849,
            "lng": 91.32321
        },
        {
            "lat": 55.19012,
            "lng": 91.32468
        },

        {
            "lat": 55.18455,
            "lng": 91.31955
        },
        {
            "lat": 51.51786,
            "lng": -0.15284
        },
        {
            "lat": 51.51787,
            "lng": -0.15288
        },


        {
            "lat": 51.13048,
            "lng": 10.35772
        }
    ],
    path6 = [




        {
            "lat": 51.51787,
            "lng": -0.15288
        },

        {
            "lat": 51.1297,
            "lng": 10.35478
        },
        {
            "lat": 51.12959,
            "lng": 10.35428
        },

        {
            "lat": -10.65178,
            "lng": -75.38716
        },

        {
            "lat": 44.44746,
            "lng": 10.94609
        },
        {
            "lat": 44.44693,
            "lng": 10.94565
        },
        {
            "lat": 44.4378,
            "lng": 11.22261
        },

        {
            "lat": 44.43786,
            "lng": 11.22246
        },



        {
            "lat": 55.18017,
            "lng": 91.31826
        },

        {
            "lat": 55.18344,
            "lng": 91.31881
        },
        {
            "lat": 55.18358,
            "lng": 91.31877
        },
        {
            "lat": 55.18372,
            "lng": 91.31882
        },
        {
            "lat": 55.18397,
            "lng": 91.31903
        },
        {
            "lat": 55.18455,
            "lng": 91.31955
        },
        {
            "lat": 55.1852,
            "lng": 91.32013
        },
        {
            "lat": 55.1863,
            "lng": 91.32109
        },
        {
            "lat": 55.18678,
            "lng": 91.32156
        },
        {
            "lat": 55.18732,
            "lng": 91.32211
        },
        {
            "lat": 55.18849,
            "lng": 91.32321
        },
        {
            "lat": 55.19012,
            "lng": 91.32468
        },


    ]


console.log(path1.length)
console.log(path2.length)
console.log(path3.length)
console.log(path4.length)
console.log(path5.length)
console.log(path6.length)

module.exports = { path1, path2, path3, path4, path5, path6 }
},{}]},{},[2]);
