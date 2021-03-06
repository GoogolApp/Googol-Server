const User = require('./user.model');
const Bar = require('../bar/bar.model');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');
const ErrorMessages = require('../helpers/ErrorMessages');
const TeamService = require('../team/team.service');

const ADD = "add";
const REMOVE = "remove";

/**
 * Load user and append to req.
 */
function load(req, res, next, id) {
  User.get(id)
    .then((user) => {
      req.queryUser = user; // eslint-disable-line no-param-reassign
      return next();
    })
    .catch(e => next(e));
}

/**
 * Get user and populate his favTeams.
 */
function get(req, res) {
  const user = req.queryUser;
  return TeamService.populateTeams(user.favTeams)
    .then((teams) => {
      const userObj = user.toObject();
      userObj.favTeams = teams;
      res.json(userObj);
    });
}

/**
 * Search users
 * @returns [{User}]
 */
function search(req, res, next) {
  User.search(req.query.keyword)
    .then((users) => {
      return res.json(users);
    })
    .catch(e => next(e));
}

/**
 * Create new user
 * @property {string} req.body.username - The username of user.
 * @property {string} req.body.name - The name of user.
 * @returns {User}
 */
function create(req, res, next) {
  const user = new User({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password
  });

  user.save()
    .then(savedUser => res.json(savedUser))
    .catch(e => next(e));
}

/**
 * Update existing user
 * @property {string} req.body.username - The username of user.
 * @returns {User}
 */
function update(req, res, next) {
  const user = req.queryUser;
  if (req.body.username) {
    user.username = req.body.username;
  }
  user.save()
    .then(savedUser => res.json(savedUser))
    .catch(e => next(e));
}

/**
 * Get user list.
 * @property {number} req.query.skip - Number of users to be skipped.
 * @property {number} req.query.limit - Limit number of users to be returned.
 * @returns {User[]}
 */
function list(req, res, next) {
  const { limit = 50, skip = 0 } = req.query;
  User.list({ limit, skip })
    .then(users => res.json(users))
    .catch(e => next(e));
}

/**
 * Delete user.
 * @returns {User}
 */
function remove(req, res, next) {
  const user = req.queryUser;
  user.remove()
    .then(deletedUser => res.json(deletedUser))
    .catch(e => next(e));
}

/**
 * Update the favorite Teams of a User. This can be an add or remove operation.
 * @property {string} req.body.operation - The operation that can be add or remove .
 * @property {string} req.body.teamId - The id of the User to be followed.
 * @property {string} req.body.queryUser - The User document that will follow.
 */
function updateFavTeams(req, res, next) {
  const user = req.queryUser;
  const teamId = req.body.favTeamId;
  const operation = req.body.operation;

  if (operation === ADD) {
    User.addFavTeam(user._id, teamId)
      .then(user => res.json(user))
      .catch(err => next(new APIError(ErrorMessages.ERROR_ON_FOLLOW_TEAM, httpStatus.BAD_REQUEST, true)));
  } else {
    User.removeFavTeam(user._id, teamId)
      .then(user => res.json(user))
      .catch(err => next(new APIError(ErrorMessages.ERROR_ON_UNFOLLOW_TEAM, httpStatus.BAD_REQUEST, true)));
  }
}


/**
 * Update the following of the User. This can be an add or remove operation.
 *
 * @property {string} req.body.operation - The operation that can be add or remove .
 * @property {string} req.body.user - The id of the User to be followed.
 * @property {string} req.body.queryUser - The User document that will follow.
 */
function updateFollowing (req, res, next) {
  const user = req.queryUser;
  const userToBeFollowedOrUnfollowedId = req.body.user;
  const operation = req.body.operation;

  if (operation === ADD) {
    _followUser(user, userToBeFollowedOrUnfollowedId)
      .then(user => res.json(user))
      .catch(err => next(new APIError(ErrorMessages.ERROR_ON_FOLLOW_USER, httpStatus.BAD_REQUEST, true)));
  } else {
    _unfollowUser(user, userToBeFollowedOrUnfollowedId)
      .then(user => res.json(user))
      .catch(err => next(new APIError(ErrorMessages.ERROR_ON_UNFOLLOW_USER, httpStatus.BAD_REQUEST, true)));  }
}

/**
 * Add a user to the queryUser following list and vice versa.
 *
 * @param user - User document of the user that will follow.
 * @param userToBeFollowedId - Id of the User that will be followed.
 * @private
 */
function _followUser (user, userToBeFollowedId) {
  return User.followUser(user, userToBeFollowedId).then(() => {
    return User.get(user._id);
  });
}

/**
 * Remove a user to the queryUser following list and vice versa.
 *
 * @param user - User document of the user that will unfollow.
 * @param userToBeUnfollowedId - Id of the User that will be unfollowed.
 * @private
 */
function _unfollowUser (user, userToBeUnfollowedId) {
  return User.unfollowUser(user, userToBeUnfollowedId).then(() => {
    return User.get(user._id);
  });
}

/**
 * Get user following users.
 * @returns {User[]}
 */
function getFollowing(req, res, next) {
  const user = req.queryUser;
  User.followingUsers(user._id)
    .then(user => res.json(user))
    .catch(e => next(e));

}

/**
 * Get user followers.
 * @returns {User[]}
 */
function getFollowers(req, res, next) {
  const user = req.queryUser;
  User.followersUsers(user._id)
    .then(user => res.json(user))
    .catch(e => next(e));
}

/**
 * Update the followingBars of the User. This can be an add or remove operation.
 *
 * @property {string} req.body.operation - The operation that can be add or remove .
 * @property {string} req.body.barId - The id of the Bar to be followed.
 * @property {string} req.body.queryUser - The User document that will follow the Bar.
 */
async function updateFollowingBars (req, res, next) {
  const user = req.queryUser;
  const barId = req.body.barId;
  const operation = req.body.operation;

  const promise = operation === ADD ?
    _followBar(user, barId) :
    _unfollowBar(user, barId);

  try {
    await promise;
    const updatedUser = await User.get(user._id);
    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
}

/**
 * Get user following bars.
 * @returns {Bar[]}
 */
function getFollowingBars(req, res, next) {
  const user = req.queryUser;
  User.followingBars(user._id)
    .then(bar => res.json(bar))
    .catch(e => next(e));
}

/**
 * Add a bar to the following User list and adds the user to the bar followers list.
 *
 * @returns {Promise.<*>}
 * @private
 */
async function _followBar (userDoc, barId) {
  try {
    const bar = await Bar.get(barId);
    await bar.addFollower(userDoc._id);
    return userDoc.followBar(barId);
  } catch (err) {
    throw err;
  }
}

/**
 * Remove the bar from the following User list and removes the user from the bar followers list.
 *
 * @returns {Promise}
 * @private
 */
async function _unfollowBar (userDoc, barId) {
  try {
    const bar = await Bar.get(barId);
    await bar.removeFollower(userDoc._id);
    return userDoc.unfollowBar(barId);
  } catch (err) {
    throw err;
  }
}

async function getFollowingBarsPromo (req, res, next) {
  try {
    const user = req.queryUser;
    const followedBars = await User.getFollowingBarsPromo(user._id);

    res.json(followedBars);
  } catch (err) {
    next(new APIError(ErrorMessages.ERROR_GETTING_PROMO_FROM_FAVORITE_BARS, httpStatus.BAD_REQUEST, true));
  }
}

module.exports = {load, get, create, update, list, remove, updateFavTeams, search, updateFollowing, updateFollowingBars, getFollowingBars, getFollowing, getFollowers, getFollowingBarsPromo};
