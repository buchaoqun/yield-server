const validator = require('validator');
const minify = require('pg-minify');

const AppError = require('../../utils/appError');
const { conn } = require('../db');
const { customHeader, customHeaderFixedCache } = require('../../utils/headers');

const cache = {}

async function getFromCache(prefix, configID, generate){
  const cacheKey = prefix+"/"+configID
  if(cache[cacheKey] === undefined || cache[cacheKey].lastUpdate < (Date.now() - 2*60*60*1e3)){
    const data = await generate()
    if(!data){
      return data
    }
    cache[cacheKey] = {
      lastUpdate: Date.now(),
      data
    }
  }
  return cache[cacheKey].data
}

const getYieldHistory = async (req, res) => {
  const configID = req.params.pool;
  if (!validator.isUUID(configID))
    return res.status(400).json('invalid configID!');

  const response = await getFromCache("yieldHistory", configID, async ()=>{
    const query = minify(
      `
          SELECT
              timestamp,
              "tvlUsd",
              apy,
              "apyBase",
              "apyReward",
              "il7d",
              "apyBase7d"
          FROM
              yield
          WHERE
              timestamp IN (
                  SELECT
                      max(timestamp)
                  FROM
                      yield
                  WHERE
                      "configID" = $<configIDValue>
                  GROUP BY
                      (timestamp :: date)
              )
              AND "configID" = $<configIDValue>
          ORDER BY
              timestamp ASC
        `,
      { compress: true }
    );

    return await conn.query(query, { configIDValue: configID });
  })

  if (!response) {
    return new AppError(`Couldn't get data`, 404);
  }

  res
    .set(customHeader(24 * 3600))
    .status(200)
    .json({
      status: 'success',
      data: response,
    });
};

const getYieldHistoryHourly = async (req, res) => {
  const configID = req.params.pool;
  if (!validator.isUUID(configID))
    return res.status(400).json('invalid configID!');

  const response = await getFromCache("yieldHistoryHourly", configID, async ()=>{
    const query = minify(
      `
          SELECT
              timestamp,
              "tvlUsd",
              apy,
              "apyBase",
              "apyReward",
              "il7d",
              "apyBase7d"
          FROM
              yield
          WHERE
              "configID" = $<configIDValue>
          ORDER BY
              timestamp ASC
        `,
      { compress: true }
    );

    return await conn.query(query, { configIDValue: configID });
  })

  if (!response) {
    return new AppError(`Couldn't get data`, 404);
  }

  res.set(customHeaderFixedCache()).status(200).json({
    status: 'success',
    data: response,
  });
};

const getYieldLendBorrowHistory = async (req, res) => {
  const configID = req.params.pool;
  if (!validator.isUUID(configID))
    return res.status(400).json('invalid configID!');

  const response = await getFromCache("yieldLendBorrowHistory", configID, async ()=>{
    const query = minify(
      `
      SELECT
          timestamp,
          "totalSupplyUsd",
          "totalBorrowUsd",
          "debtCeilingUsd",
          "apyBase",
          "apyReward",
          "apyBaseBorrow",
          "apyRewardBorrow"
      FROM
          yield
      WHERE
          timestamp IN (
              SELECT
                  max(timestamp)
              FROM
                  yield
              WHERE
                  "configID" = $<configIDValue>
              GROUP BY
                  (timestamp :: date)
          )
          AND "configID" = $<configIDValue>
      ORDER BY
          timestamp ASC
    `,
      { compress: true }
    );

    return await conn.query(query, { configIDValue: configID });
  })

  if (!response) {
    return new AppError(`Couldn't get data`, 404);
  }

  res
    .set(customHeader(24 * 3600))
    .status(200)
    .json({
      status: 'success',
      data: response,
    });
};

module.exports = {
  getYieldHistory,
  getYieldHistoryHourly,
  getYieldLendBorrowHistory,
};
