package com.zxl.resume.common.mybatis;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedTypes;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

@MappedTypes(UUID.class)
public class UuidTypeHandler extends BaseTypeHandler<UUID> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, UUID parameter, JdbcType jdbcType) throws SQLException {
        ps.setObject(i, parameter);
    }

    @Override
    public UUID getNullableResult(ResultSet rs, String columnName) throws SQLException {
        String val = rs.getString(columnName);
        return val == null ? null : UUID.fromString(val);
    }

    @Override
    public UUID getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        String val = rs.getString(columnIndex);
        return val == null ? null : UUID.fromString(val);
    }

    @Override
    public UUID getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        String val = cs.getString(columnIndex);
        return val == null ? null : UUID.fromString(val);
    }
}
